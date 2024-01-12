import { Service } from 'typedi';
import { DataSource, Repository, In, Not } from 'typeorm';
import type { EntityManager, FindOptionsSelect, FindOptionsWhere } from 'typeorm';
import { SharedWorkflow } from '../entities/SharedWorkflow';
import { type User } from '../entities/User';
import type { Scope } from '@n8n/permissions';
import type { Role } from '../entities/Role';
import type { WorkflowEntity } from '../entities/WorkflowEntity';

@Service()
export class SharedWorkflowRepository extends Repository<SharedWorkflow> {
	constructor(dataSource: DataSource) {
		super(SharedWorkflow, dataSource.manager);
	}

	async hasAccess(workflowId: string, user: User) {
		const where: FindOptionsWhere<SharedWorkflow> = {
			workflowId,
		};
		if (!user.hasGlobalScope('workflow:read')) {
			where.userId = user.id;
		}
		return this.exist({ where });
	}

	async getSharedWorkflowIds(workflowIds: string[]) {
		const sharedWorkflows = await this.find({
			select: ['workflowId'],
			where: {
				workflowId: In(workflowIds),
			},
		});
		return sharedWorkflows.map((sharing) => sharing.workflowId);
	}

	async findByWorkflowIds(workflowIds: string[]) {
		return this.find({
			relations: ['role', 'user'],
			where: {
				role: {
					name: 'owner',
					scope: 'workflow',
				},
				workflowId: In(workflowIds),
			},
		});
	}

	async findSharing(
		workflowId: string,
		user: User,
		scope: Scope,
		{ roles, extraRelations }: { roles?: string[]; extraRelations?: string[] } = {},
	) {
		const where: FindOptionsWhere<SharedWorkflow> = {
			workflow: { id: workflowId },
		};

		if (!user.hasGlobalScope(scope)) {
			where.user = { id: user.id };
		}

		if (roles) {
			where.role = { name: In(roles) };
		}

		const relations = ['workflow', 'role'];

		if (extraRelations) relations.push(...extraRelations);

		return this.findOne({ relations, where });
	}

	async makeOwnerOfAllWorkflows(user: User, role: Role) {
		return this.update({ userId: Not(user.id), roleId: role.id }, { user });
	}

	async getSharing(
		user: User,
		workflowId: string,
		options: { allowGlobalScope: true; globalScope: Scope } | { allowGlobalScope: false },
		relations: string[] = ['workflow'],
	): Promise<SharedWorkflow | null> {
		const where: FindOptionsWhere<SharedWorkflow> = { workflowId };

		// Omit user from where if the requesting user has relevant
		// global workflow permissions. This allows the user to
		// access workflows they don't own.
		if (!options.allowGlobalScope || !user.hasGlobalScope(options.globalScope)) {
			where.userId = user.id;
		}

		return this.findOne({ where, relations });
	}

	async getSharedWorkflows(
		user: User,
		options: {
			relations?: string[];
			workflowIds?: string[];
		},
	): Promise<SharedWorkflow[]> {
		return this.find({
			where: {
				...(!['owner', 'admin'].includes(user.globalRole.name) && { userId: user.id }),
				...(options.workflowIds && { workflowId: In(options.workflowIds) }),
			},
			...(options.relations && { relations: options.relations }),
		});
	}

	async share(transaction: EntityManager, workflow: WorkflowEntity, users: User[], roleId: string) {
		const newSharedWorkflows = users.reduce<SharedWorkflow[]>((acc, user) => {
			if (user.isPending) {
				return acc;
			}
			const entity: Partial<SharedWorkflow> = {
				workflowId: workflow.id,
				userId: user.id,
				roleId,
			};
			acc.push(this.create(entity));
			return acc;
		}, []);

		return transaction.save(newSharedWorkflows);
	}

	async findWithFields(workflowIds: string[], { fields }: { fields: string[] }) {
		return this.find({
			where: {
				workflowId: In(workflowIds),
			},
			select: fields as FindOptionsSelect<SharedWorkflow>,
		});
	}

	async deleteByIds(transaction: EntityManager, sharedWorkflowIds: string[], user?: User) {
		return transaction.delete(SharedWorkflow, {
			user,
			workflowId: In(sharedWorkflowIds),
		});
	}

	async findWorkflowIdsByUser(user: User, { roles }: { roles?: Role[] } = {}) {
		const where: FindOptionsWhere<SharedWorkflow> = {};

		if (!user.hasGlobalScope('workflow:read')) where.userId = user.id;

		if (roles) where.role = In(roles.map((r) => r.id));

		const sharings = await this.find({ select: ['workflowId'], where });

		return sharings.map((s) => s.workflowId);
	}
}
