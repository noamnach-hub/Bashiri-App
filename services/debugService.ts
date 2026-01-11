export const debugStore: any[] = [];

export const addDebugLog = (label: string, data: any) => {
    debugStore.unshift({ timestamp: new Date().toISOString(), label, data });
    if (debugStore.length > 50) debugStore.pop();
};

export const getDebugLogs = () => debugStore;
