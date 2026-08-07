import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, getNotificationConfig, updateNotificationConfig } from "@/lib/api";
import type { NotificationConfig } from "@/lib/api";

const NOTIFICATION_CONFIG_QUERY_KEY = ["admin", "notification-config"] as const;

export default function AdminNotifications() {
    const queryClient = useQueryClient();
    const { data: config } = useQuery({
        queryKey: NOTIFICATION_CONFIG_QUERY_KEY,
        queryFn: getNotificationConfig,
    });

    const [webhookUrl, setWebhookUrl] = useState("");
    const [webhookEnabled, setWebhookEnabled] = useState(false);
    const [queueLowThreshold, setQueueLowThreshold] = useState("");
    const [networkEgressEnabled, setNetworkEgressEnabled] = useState(true);

    useEffect(() => {
        if (!config) return;
        setWebhookUrl(config.webhook_url ?? "");
        setWebhookEnabled(config.webhook_enabled);
        setQueueLowThreshold(
            config.queue_low_threshold === null ? "" : String(config.queue_low_threshold)
        );
        setNetworkEgressEnabled(config.network_egress_enabled);
    }, [config]);

    const mutation = useMutation({
        mutationFn: (partial: Partial<NotificationConfig>) => updateNotificationConfig(partial),
        onSuccess: () => {
            toast.success("Configuração de notificações salva.");
            void queryClient.invalidateQueries({ queryKey: NOTIFICATION_CONFIG_QUERY_KEY });
        },
        onError: (error) => {
            toast.error(
                error instanceof ApiError
                    ? error.message
                    : "Não foi possível salvar a configuração de notificações."
            );
        },
    });

    const handleSave = () => {
        mutation.mutate({
            webhook_url: webhookUrl.trim() === "" ? null : webhookUrl.trim(),
            webhook_enabled: webhookEnabled,
            queue_low_threshold:
                queueLowThreshold.trim() === "" ? null : Number(queueLowThreshold),
            network_egress_enabled: networkEgressEnabled,
        });
    };

    return (
        <div className="min-h-screen p-6 max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-slate-800">Notificações Slack/Teams</h1>
                <Link to="/admin" className="text-sm text-sky-600 hover:underline">
                    Voltar ao Admin
                </Link>
            </div>

            <div className="bg-white rounded-md border p-4 space-y-4">
                <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-700">URL do webhook</span>
                    <input
                        aria-label="URL do webhook"
                        type="text"
                        value={webhookUrl}
                        onChange={(event) => setWebhookUrl(event.target.value)}
                        placeholder="https://hooks.slack.com/services/..."
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                </label>

                <label className="flex items-center gap-2">
                    <input
                        aria-label="Notificações Slack/Teams ativadas"
                        type="checkbox"
                        checked={webhookEnabled}
                        onChange={(event) => setWebhookEnabled(event.target.checked)}
                    />
                    <span className="text-sm text-slate-700">
                        Notificações Slack/Teams ativadas
                    </span>
                </label>

                <label className="block space-y-1">
                    <span className="text-sm font-medium text-slate-700">
                        Limite da Fila para notificar reabastecimento
                    </span>
                    <input
                        aria-label="Limite da Fila para notificar reabastecimento"
                        type="number"
                        min={0}
                        value={queueLowThreshold}
                        onChange={(event) => setQueueLowThreshold(event.target.value)}
                        placeholder="Sem limite configurado"
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                </label>

                <div className="border-t pt-4">
                    <label className="flex items-center gap-2">
                        <input
                            aria-label="Permitir saída de rede (desligue para ambientes air-gapped)"
                            type="checkbox"
                            checked={networkEgressEnabled}
                            onChange={(event) => setNetworkEgressEnabled(event.target.checked)}
                        />
                        <span className="text-sm text-slate-700">
                            Permitir saída de rede (desligue para ambientes air-gapped)
                        </span>
                    </label>
                    <p className="mt-1 text-xs text-slate-500">
                        Interruptor mestre para a única saída de rede externa do sistema —
                        desligado, nenhuma chamada de webhook é feita, mesmo que as notificações
                        acima estejam ativadas.
                    </p>
                </div>

                <button
                    type="button"
                    className="text-sky-600 hover:underline text-sm"
                    onClick={handleSave}
                    disabled={mutation.isPending}
                >
                    Salvar
                </button>
            </div>
        </div>
    );
}
