export interface SubcategoryDef {
  value: string
  label: string
  defaultPriority: 'low' | 'normal' | 'high' | 'urgent' | 'critical'
}

export const CATEGORY_SUBCATEGORIES: Record<string, { label: string; subcategories: SubcategoryDef[] }> = {
  account: {
    label: 'Account',
    subcategories: [
      { value: 'login', label: 'Login issues', defaultPriority: 'normal' },
      { value: 'recovery', label: 'Account recovery', defaultPriority: 'high' },
      { value: 'email_verification', label: 'Email verification', defaultPriority: 'normal' },
      { value: 'deletion', label: 'Account deletion', defaultPriority: 'normal' },
      { value: 'other', label: 'Other', defaultPriority: 'normal' },
    ],
  },
  billing: {
    label: 'Billing',
    subcategories: [
      { value: 'upgrade', label: 'Storage upgrade', defaultPriority: 'low' },
      { value: 'payment', label: 'Payment issue', defaultPriority: 'high' },
      { value: 'refund', label: 'Refund request', defaultPriority: 'normal' },
      { value: 'other', label: 'Other', defaultPriority: 'normal' },
    ],
  },
  technical: {
    label: 'Technical',
    subcategories: [
      { value: 'upload', label: 'Upload issues', defaultPriority: 'normal' },
      { value: 'download', label: 'Download issues', defaultPriority: 'normal' },
      { value: 'api', label: 'API issues', defaultPriority: 'normal' },
      { value: 'webhook', label: 'Webhook issues', defaultPriority: 'normal' },
      { value: 'performance', label: 'Performance', defaultPriority: 'normal' },
      { value: 'other', label: 'Other', defaultPriority: 'normal' },
    ],
  },
  abuse: {
    label: 'Abuse',
    subcategories: [
      { value: 'report_user', label: 'Report a user', defaultPriority: 'high' },
      { value: 'report_file', label: 'Report a file', defaultPriority: 'high' },
      { value: 'dmca', label: 'DMCA notice', defaultPriority: 'urgent' },
      { value: 'other', label: 'Other', defaultPriority: 'normal' },
    ],
  },
  feature_request: {
    label: 'Feature Request',
    subcategories: [
      { value: 'new_feature', label: 'New feature', defaultPriority: 'low' },
      { value: 'improvement', label: 'Improvement', defaultPriority: 'low' },
      { value: 'integration', label: 'Integration', defaultPriority: 'low' },
      { value: 'other', label: 'Other', defaultPriority: 'low' },
    ],
  },
  general: {
    label: 'General',
    subcategories: [
      { value: 'question', label: 'Question', defaultPriority: 'low' },
      { value: 'feedback', label: 'Feedback', defaultPriority: 'low' },
      { value: 'other', label: 'Other', defaultPriority: 'low' },
    ],
  },
}

export function getSubcategories(category: string) {
  return CATEGORY_SUBCATEGORIES[category]?.subcategories ?? CATEGORY_SUBCATEGORIES.general.subcategories
}

export function getCategoryLabel(category: string) {
  return CATEGORY_SUBCATEGORIES[category]?.label ?? category
}

export function getSubcategoryLabel(category: string, subcategory: string) {
  const subs = getSubcategories(category)
  return subs.find((s) => s.value === subcategory)?.label ?? subcategory
}

export function getDefaultPriority(category: string, subcategory: string): string {
  const subs = getSubcategories(category)
  return subs.find((s) => s.value === subcategory)?.defaultPriority ?? 'normal'
}

export const CATEGORIES = Object.entries(CATEGORY_SUBCATEGORIES).map(([value, cat]) => ({
  value,
  label: cat.label,
}))
