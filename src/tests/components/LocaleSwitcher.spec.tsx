import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Steuerung der Promise für changeLanguage
let resolveChangeLanguage: (() => void) | undefined;

// i18next Mock
vi.mock('i18next', () => {
    let currentLang = 'en';
    const changeLanguage = vi.fn().mockImplementation((lng: string) => {
        currentLang = lng;
        return new Promise<void>(res => {
            resolveChangeLanguage = res;
        });
    });
    return {
        default: {
            get language() {
                return currentLang;
            },
            changeLanguage
        }
    };
});

import i18next from 'i18next';
import LocaleSwitcher from "../../components/LocaleSwitcher.tsx";


beforeEach(() => {
    resolveChangeLanguage = undefined;
    vi.clearAllMocks();
});

describe('LocaleSwitcher', () => {
    it('should be rendered', () => {
        render(<LocaleSwitcher />);
        const select = screen.getByRole('combobox');
        expect(select).toHaveValue('en');
        expect(screen.getByRole('option', {name: /English/i})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: /Deutsch/i})).toBeInTheDocument();
    });

    it('should be disabled during change transition', async () => {
        render(<LocaleSwitcher />);
        const select = screen.getByRole('combobox');

        // Aktion: auf Deutsch wechseln
        await userEvent.selectOptions(select, 'de');

        expect(i18next.changeLanguage).toHaveBeenCalledTimes(1);
        expect(i18next.changeLanguage).toHaveBeenCalledWith('de');

        // Wert bereits umgestellt (State vor Await)
        expect(select).toHaveValue('de');

        // Während Promise offen -> disabled
        expect(select).toBeDisabled();

        // Transition auflösen
        resolveChangeLanguage && resolveChangeLanguage();

        // Warten bis disabled entfernt
        await waitFor(() => expect(select).not.toBeDisabled());
    });
});

