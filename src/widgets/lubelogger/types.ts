export type LubeloggerOptions = {
    vehicleID?: string | number;
};

export type LubeloggerVehicle = {
    vehicleData: { id: string | number; year: number; model: string };
    veryUrgentReminderCount: number;
    urgentReminderCount: number;
    notUrgentReminderCount: number;
    serviceRecordCount: number;
    nextReminder?: { dueDate: string };
};
