export type AuthoredTemplateKind = 'sls' | 'shell';

export interface AuthoredSaltTemplate {
	id: string;
	kind: AuthoredTemplateKind;
	name: string;
	description: string;
	stateName: string;
	content: string;
	updatedAt: string;
}

export interface AuthoredTemplateDraft {
	kind: AuthoredTemplateKind;
	name: string;
	description: string;
	stateName: string;
	content: string;
}

export const SALT_TEMPLATE_STORAGE_KEY = 'itms_salt_workspace_templates_v1';

export function loadAuthoredSaltTemplates() {
	if (typeof window === 'undefined') {
		return [] as AuthoredSaltTemplate[];
	}

	try {
		const raw = window.localStorage.getItem(SALT_TEMPLATE_STORAGE_KEY);
		if (!raw) {
			return [] as AuthoredSaltTemplate[];
		}
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [] as AuthoredSaltTemplate[];
		}
		return parsed.filter((entry): entry is AuthoredSaltTemplate => {
			return Boolean(entry)
				&& (entry.kind === 'sls' || entry.kind === 'shell')
				&& typeof entry.id === 'string'
				&& typeof entry.name === 'string'
				&& typeof entry.description === 'string'
				&& typeof entry.stateName === 'string'
				&& typeof entry.content === 'string'
				&& typeof entry.updatedAt === 'string';
		});
	} catch {
		return [] as AuthoredSaltTemplate[];
	}
}

export function createEmptyTemplateDraft(kind: AuthoredTemplateKind = 'sls'): AuthoredTemplateDraft {
	return {
		kind,
		name: '',
		description: '',
		stateName: kind === 'sls' ? 'patch.run' : '',
		content: '',
	};
}