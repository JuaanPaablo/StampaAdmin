export interface FormState {
  ok: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}
export const initialFormState: FormState = { ok: false };
