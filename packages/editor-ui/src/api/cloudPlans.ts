import type { Cloud, IRestApiContext, InstanceUsage } from '@/Interface';
import { get } from '@/utils';

export async function getCurrentPlan(context: IRestApiContext): Promise<Cloud.PlanData> {
	return get(context.baseUrl, '/admin/cloud-plan');
}

export async function getCurrentUsage(context: IRestApiContext): Promise<InstanceUsage> {
	return get(context.baseUrl, '/cloud/limits');
}

export async function getAdminPanelLoginCode(context: IRestApiContext) {
	return get(context.baseUrl, '/admin/auth/login/code');
}
