"""
Ticket 15 E2E bootstrap: seed one human Actor directly in the test database.

There's no public registration endpoint — every Actor is normally created
via the Admin API, which itself requires an existing Admin to call. Direct
DB insertion is the correct, simplest way to bootstrap the very first user
(the same thing the coordinator did by hand to verify ticket 14). This
script runs inside tracker-api's own image (via the `seed` service in
e2e/docker-compose.e2e.yml), so it reuses the app's real ORM models and
password hashing — no need to replicate bcrypt in Node.

Role is Admin so this one seeded user can also call the Admin API to create
the ai_agent Actor + mint its token (see e2e/admin-setup.ts) — status
transitions and task edits aren't role-restricted for authenticated humans
(ticket 12), so this same user performs every human-driven step in the
happy-path test too.

Idempotent by email: `docker compose run`'s dependency resolution
re-triggers this service's full depends_on chain on every invocation
(a prior `run` of this same service doesn't count as already-satisfied
for a later service's `condition: service_completed_successfully` check),
so this script may genuinely execute more than once against the same
database — skip rather than fail on a duplicate email.
"""

import asyncio
import os
import sys
import uuid

sys.path.insert(0, "/code")

from sqlalchemy import select  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db import async_session_factory  # noqa: E402
from app.models import Actor, ActorRole, ActorType  # noqa: E402


async def main() -> None:
    email = os.environ["E2E_ADMIN_EMAIL"]
    password = os.environ["E2E_ADMIN_PASSWORD"]
    async with async_session_factory() as session:
        existing = await session.execute(select(Actor).where(Actor.email == email))
        if existing.scalar_one_or_none() is not None:
            print(f"bootstrap admin actor already seeded, skipping: email={email}")
            return

        actor = Actor(
            id=uuid.uuid4(),
            type=ActorType.HUMAN,
            name="E2E Admin",
            email=email,
            role=ActorRole.ADMIN,
            active=True,
            password_hash=hash_password(password),
        )
        session.add(actor)
        await session.commit()
        print(f"seeded bootstrap admin actor id={actor.id} email={email}")


if __name__ == "__main__":
    asyncio.run(main())
