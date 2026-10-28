export interface AdministrativeIncidentHistoryEntry {
    id: string;
    savedAt: string;
    date: string;
    place: string;
    investigator: string;
    investigatorTitle: string;
    investigatorUnit: string;
    violator: string;
    violatorCode: string;
    violatorTitle: string;
    incidentTime: string;
    incidentDetail: string;
    incidentItems: string;
    cause: string;
    faultAssessment: string;
    proposal: string;
    compensationDeadline: string;
}

export const administrativeIncidentHistoryStorageKey = 'qlkho_administrative_incident_history';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const getStorage = (): StorageLike | null => typeof window === 'undefined' ? null : window.localStorage;

export const readAdministrativeIncidentHistory = (storage: StorageLike | null = getStorage()): AdministrativeIncidentHistoryEntry[] => {
    if (!storage) return [];
    try {
        const parsed: unknown = JSON.parse(storage.getItem(administrativeIncidentHistoryStorageKey) || '[]');
        return Array.isArray(parsed) ? parsed.filter((entry): entry is AdministrativeIncidentHistoryEntry => Boolean(entry && typeof entry === 'object' && 'id' in entry && 'savedAt' in entry)) : [];
    } catch {
        return [];
    }
};

export const saveAdministrativeIncidentHistory = (
    entry: Omit<AdministrativeIncidentHistoryEntry, 'id' | 'savedAt'>,
    storage: StorageLike | null = getStorage(),
    now = new Date(),
): AdministrativeIncidentHistoryEntry => {
    const record: AdministrativeIncidentHistoryEntry = {
        ...entry,
        id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
        savedAt: now.toISOString(),
    };
    if (!storage) return record;
    storage.setItem(administrativeIncidentHistoryStorageKey, JSON.stringify([record, ...readAdministrativeIncidentHistory(storage)]));
    return record;
};
