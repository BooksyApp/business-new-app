import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/** FG-W4-02: the field types a salon can put on a form. */
export type ConsentFieldType = "TEXT" | "LONG_TEXT" | "YES_NO" | "CHOICE" | "DATE" | "CONSENT" | "SIGNATURE";

export interface ConsentFormField {
  key?: string;
  type: ConsentFieldType;
  labelAz: string;
  labelEn: string;
  labelRu: string;
  options: string[];
  required: boolean;
  sensitive: boolean;
}

export interface ConsentForm {
  id: Id;
  name: string;
  fields: ConsentFormField[];
  serviceIds: Id[];
}

export interface ConsentFormInput {
  name: string;
  fields: ConsentFormField[];
  serviceIds: Id[];
}

export interface ClientConsentAnswer {
  key: string;
  type: ConsentFieldType;
  label: string;
  sensitive: boolean;
  hidden: boolean;
  value: string | null;
}

export interface ClientConsentSubmission {
  id: Id;
  formName: string;
  signedName: string;
  signedAt: string;
  answers: ClientConsentAnswer[];
}

export const consentFormService = {
  list(businessId: Id): Promise<ConsentForm[]> {
    return apiClient.get<ConsentForm[]>(`/consent-forms/business/${businessId}`);
  },

  create(businessId: Id, body: ConsentFormInput): Promise<ConsentForm> {
    return apiClient.post<ConsentForm>(`/consent-forms/business/${businessId}`, body);
  },

  update(id: Id, body: ConsentFormInput): Promise<ConsentForm> {
    return apiClient.put<ConsentForm>(`/consent-forms/${id}`, body);
  },

  /** The signed forms on a client's card; sensitive answers come back hidden unless allowed. */
  forClient(clientId: Id): Promise<ClientConsentSubmission[]> {
    return apiClient.get<ClientConsentSubmission[]>(`/clients/${clientId}/consent-submissions`);
  },
};
