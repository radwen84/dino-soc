import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BoltIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import toast from "react-hot-toast";
import api from "../lib/api";
import { DataTable } from "../components/common/DataTable";

interface Approval {
  id: string;
  action: string;
  actionName?: string;
  target?: string;
  status: "pending" | "approved" | "rejected";
  playbookName?: string;
  createdAt: string;
}

interface Playbook {
  id: string;
  name: string;
  description: string;
  enabled?: boolean;
  is_active?: boolean;
  isActive?: boolean;
  triggerEvent?: string;
  triggerConditions?: any;
  trigger_conditions?: any;
}

export function SoarPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"approvals" | "playbooks">("approvals");

  // États pour la modale d'exécution manuelle avec paramètres cibles
  const [selectedPlaybookForExec, setSelectedPlaybookForExec] = useState<Playbook | null>(null);
  const [targetIp, setTargetIp] = useState("192.168.1.50");
  const [alertLevel, setAlertLevel] = useState("12");

  // 1. Récupération des demandes d'approbation
  const { data: approvalsResponse, isLoading: isLoadingApprovals } = useQuery({
    queryKey: ["soar-approvals"],
    queryFn: async () => {
      const { data } = await api.get("/soar/approvals");
      return data;
    },
    refetchInterval: 10000,
  });

  const approvalsList: Approval[] = Array.isArray(approvalsResponse)
    ? approvalsResponse
    : approvalsResponse?.data || [];

  // 2. Récupération des playbooks
  const { data: playbooksResponse, isLoading: isLoadingPlaybooks } = useQuery({
    queryKey: ["soar-playbooks"],
    queryFn: async () => {
      const { data } = await api.get("/soar/playbooks");
      return data;
    },
  });

  const playbooksList: Playbook[] = Array.isArray(playbooksResponse)
    ? playbooksResponse
    : playbooksResponse?.data || [];

  // Mutation pour Approuver / Rejeter une action SOAR
  const handleApprovalMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => {
      const { data } = await api.post(`/soar/approvals/${id}/decide`, {
        decision,
        reason: "Décision enregistrée depuis l'interface web",
      });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["soar-approvals"] });
      toast.success(
        variables.decision === "approved"
          ? "Action approuvée et exécutée"
          : "Action rejetée",
      );
    },
    onError: () => {
      toast.error("Échec de la prise de décision");
    },
  });

  // Mutation pour Activer / Désactiver un Playbook
  const togglePlaybookMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data } = await api.patch(`/soar/playbooks/${id}/toggle`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["soar-playbooks"] });
      toast.success("Statut du playbook mis à jour");
    },
    onError: () => {
      toast.error("Échec de la modification du statut");
    },
  });

  // Mutation pour Exécuter Manuellement un Playbook avec données d'injection (testData)
  const executePlaybookMutation = useMutation({
    mutationFn: async ({ id, testData }: { id: string; testData: any }) => {
      const { data } = await api.post(`/soar/playbooks/${id}/execute`, {
        dryRun: false,
        testData,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["soar-approvals"] });
      toast.success(`Playbook exécuté avec succès (ID: ${data.executionId || "OK"})`);
      setSelectedPlaybookForExec(null);
    },
    onError: () => {
      toast.error("Échec de l'exécution du playbook");
    },
  });

  const approvalColumns = [
    {
      key: "actionName",
      label: "Action Requise",
      render: (item: Approval) => (
        <div>
          <p className="font-semibold text-white text-sm">{item.actionName || item.action}</p>
          <p className="text-xs text-soc-muted font-mono">{item.action}</p>
        </div>
      ),
    },
    {
      key: "target",
      label: "Cible",
      render: (item: Approval) => (
        <span className="font-mono text-xs text-soc-accent">{item.target || "—"}</span>
      ),
    },
    {
      key: "playbookName",
      label: "Playbook Origine",
      render: (item: Approval) => (
        <span className="text-xs text-soc-muted">{item.playbookName || "SDR / Automated Playbook"}</span>
      ),
    },
    {
      key: "createdAt",
      label: "Demandé",
      width: "130px",
      render: (item: Approval) => (
        <span className="text-xs text-soc-muted">
          {item.createdAt
            ? formatDistanceToNow(new Date(item.createdAt), {
                addSuffix: true,
                locale: fr,
              })
            : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Décision",
      width: "180px",
      render: (item: Approval) => (
        <div className="flex items-center gap-2">
          {item.status === "pending" ? (
            <>
              <button
                type="button"
                onClick={() => handleApprovalMutation.mutate({ id: item.id, decision: "approved" })}
                disabled={handleApprovalMutation.isPending}
                className="btn-primary py-1 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1 cursor-pointer"
              >
                <CheckCircleIcon className="h-4 w-4" /> Approuver
              </button>
              <button
                type="button"
                onClick={() => handleApprovalMutation.mutate({ id: item.id, decision: "rejected" })}
                disabled={handleApprovalMutation.isPending}
                className="btn-ghost py-1 px-2.5 text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 flex items-center gap-1 cursor-pointer"
              >
                <XCircleIcon className="h-4 w-4" /> Rejeter
              </button>
            </>
          ) : (
            <span
              className={`badge text-xs px-2 py-0.5 rounded border ${
                item.status === "approved"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-red-500/20 text-red-300 border-red-500/30"
              }`}
            >
              {item.status}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BoltIcon className="h-6 w-6 text-soc-accent" /> Orchestration & Automatisation (SOAR)
          </h1>
          <p className="text-xs text-soc-muted mt-1">
            Gestion des Playbooks et approbation des réponses d'atténuation d'incidents.
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex items-center gap-4 border-b border-soc-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("approvals")}
          className={`text-sm font-medium pb-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === "approvals"
              ? "border-soc-accent text-white"
              : "border-transparent text-soc-muted hover:text-white"
          }`}
        >
          Approbations en attente
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("playbooks")}
          className={`text-sm font-medium pb-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === "playbooks"
              ? "border-soc-accent text-white"
              : "border-transparent text-soc-muted hover:text-white"
          }`}
        >
          Playbooks disponibles
        </button>
      </div>

      {/* Contenu de l'onglet Approbations */}
      {activeTab === "approvals" && (
        <div className="space-y-4">
          <DataTable<Approval>
            columns={approvalColumns}
            data={approvalsList}
            isLoading={isLoadingApprovals}
            emptyMessage="Aucune demande d'approbation SOAR en attente."
          />
        </div>
      )}

      {/* Contenu de l'onglet Playbooks */}
      {activeTab === "playbooks" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoadingPlaybooks ? (
            <p className="text-xs text-soc-muted">Chargement des playbooks...</p>
          ) : playbooksList.length === 0 ? (
            <p className="text-xs text-soc-muted col-span-2">Aucun playbook configuré.</p>
          ) : (
            playbooksList.map((pb) => {
              const isPlaybookActive = pb.enabled ?? pb.is_active ?? pb.isActive ?? false;

              // Formatage lisible du déclencheur
              const triggerObj = pb.triggerConditions || pb.trigger_conditions;
              const formatTrigger = (obj: any) => {
                if (!obj) return "—";
                if (typeof obj === "string") return obj;
                if (obj.rules && Array.isArray(obj.rules) && obj.rules.length > 0) {
                  const rule = obj.rules[0];
                  const type = obj.triggerType ? obj.triggerType.toUpperCase() : "ÉVÉNEMENT";
                  return `${type} : ${rule.field} ${rule.operator} ${rule.value}`;
                }
                return JSON.stringify(obj);
              };

              const trigger = pb.triggerEvent || formatTrigger(triggerObj);

              return (
                <div key={pb.id} className="card border border-soc-border flex flex-col justify-between p-4 rounded-lg bg-soc-card">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-white">{pb.name}</h3>
                      
                      <div className="flex items-center gap-2">
                        {/* Bouton pour ouvrir la modale d'exécution manuelle */}
                        <button
                          type="button"
                          onClick={() => setSelectedPlaybookForExec(pb)}
                          disabled={!isPlaybookActive}
                          title="Déclencher manuellement ce playbook sur une cible"
                          className="btn-primary py-1 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <PlayIcon className="h-3.5 w-3.5" /> Exécuter
                        </button>

                        {/* Bouton de basculement d'état (Actif / Désactivé) */}
                        <button
                          type="button"
                          onClick={() => togglePlaybookMutation.mutate({ id: pb.id })}
                          disabled={togglePlaybookMutation.isPending}
                          className={`badge text-xs px-2 py-0.5 rounded border cursor-pointer transition-all ${
                            isPlaybookActive
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
                              : "bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30"
                          }`}
                        >
                          {isPlaybookActive ? "Actif" : "Désactivé"}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-soc-muted mb-3">{pb.description}</p>
                  </div>
                  
                  <div className="text-[11px] font-mono text-soc-accent bg-soc-surface p-2 rounded border border-soc-border overflow-x-auto">
                    Déclencheur: {trigger}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modale d'injection de données cibles pour l'exécution manuelle */}
      {selectedPlaybookForExec && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-soc-card border border-soc-border rounded-lg p-6 max-w-md w-full space-y-4">
            <h2 className="text-base font-bold text-white">
              Exécuter : {selectedPlaybookForExec.name}
            </h2>
            <p className="text-xs text-soc-muted">
              Définissez les données cibles transmises au moteur de playbook.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-soc-muted mb-1">Adresse IP Cible (srcIp) :</label>
                <input
                  type="text"
                  value={targetIp}
                  onChange={(e) => setTargetIp(e.target.value)}
                  className="w-full bg-soc-surface border border-soc-border rounded p-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-soc-muted mb-1">Niveau d'alerte (level) :</label>
                <input
                  type="number"
                  value={alertLevel}
                  onChange={(e) => setAlertLevel(e.target.value)}
                  className="w-full bg-soc-surface border border-soc-border rounded p-2 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedPlaybookForExec(null)}
                className="btn-ghost py-1.5 px-3 text-xs text-soc-muted cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() =>
                  executePlaybookMutation.mutate({
                    id: selectedPlaybookForExec.id,
                    testData: {
                      srcIp: targetIp,
                      level: Number(alertLevel),
                      title: `Exécution manuelle sur ${targetIp}`,
                    },
                  })
                }
                disabled={executePlaybookMutation.isPending}
                className="btn-primary py-1.5 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded cursor-pointer"
              >
                {executePlaybookMutation.isPending ? "Exécution..." : "Confirmer & Lancer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
