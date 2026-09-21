import { z } from 'zod';

export const categoryStatuses = ['DRAFT', 'ACTIVE', 'CLOSED'] as const;
export const categoryStatusLabels = { DRAFT: 'Borrador', ACTIVE: 'Activa', CLOSED: 'Cerrada' };
const positiveInteger = (value: string) => /^[1-9]\d*$/.test(value) && Number(value) <= 2147483647;

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre de la categoría.').max(100, 'Usa como máximo 100 caracteres.'),
  description: z.string().trim().max(3000, 'Usa como máximo 3000 caracteres.'),
  max_teams: z.string().trim().refine(value => value === '' || positiveInteger(value), 'Escribe un número entero positivo o deja el campo vacío.'),
  sort_order: z.string().trim().refine(value => value === '0' || positiveInteger(value), 'Escribe un entero entre 0 y 2147483647.'),
  status: z.enum(categoryStatuses),
});
export type CategoryValues = z.infer<typeof categorySchema>;
export type CategoryState = {
  message?: string;
  errors?: Partial<Record<keyof CategoryValues, string[]>>;
  values?: CategoryValues;
};
export type CategoryRecord = Omit<CategoryValues, 'description' | 'max_teams' | 'sort_order'> & {
  id: string;
  event_id: string;
  description: string | null;
  max_teams: number | null;
  sort_order: number;
  updated_at: string;
};
export const emptyCategory: CategoryValues = { name: '', description: '', max_teams: '', sort_order: '0', status: 'DRAFT' };
export function categoryPayload(values: CategoryValues) {
  return { ...values, max_teams: values.max_teams ? Number(values.max_teams) : null, sort_order: Number(values.sort_order) };
}
export function categoryValues(record: CategoryRecord): CategoryValues {
  return { name: record.name, description: record.description ?? '', max_teams: record.max_teams?.toString() ?? '', sort_order: String(record.sort_order), status: record.status };
}
