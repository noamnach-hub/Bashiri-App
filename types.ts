export interface FireberryUser {
  id: string; // This will be the ownerid (User ID) from the Agent record
  agentId: string; // The customobject1012id
  username: string; // Agent Name
  emailaddress: string; // Agent Email (pcfsystemfield446)
  password?: string; // Agent Phone (pcfsystemfield438)
  isactive: boolean;
}

export interface FireberryAccount {
  accountid: string;
  name: string;
  phone: string;
  description?: string;
  accounttypecode?: string;
  statuscode?: string;
  call_recording_link?: string;
  ownerid: string;
}

export interface FireberryInquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  description?: string;
  statuscode?: string;
  createdon: string;
  agentId: string;
}

export interface FireberryTask {
  activityid: string;
  subject: string;
  description?: string;
  scheduledend: string;
  statuscode: string;
  regardingobjectid?: string;
  regardingobjectidname?: string;
  ownerid: string;
}

export interface SnoozeItem {
  id: string;
  leadId: string;
  leadName: string;
  remindAt: number;
  note: string;
}

export interface AgentStats {
  inquiries: number;
  tours: number;
  properties: number;
  accounts: number;
  leases: number;
  visits: number;
}

export enum ViewState {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  LEAD_LIST = 'LEAD_LIST',
  LEAD_DETAIL = 'LEAD_DETAIL',
  FOLLOWUP_LIST = 'FOLLOWUP_LIST',
  SNOOZE_LIST = 'SNOOZE_LIST'
}