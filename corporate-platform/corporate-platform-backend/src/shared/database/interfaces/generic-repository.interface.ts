/**
 * Generic repository interface for standard CRUD operations.
 * Entity-specific repositories extend this for consistent data access abstraction.
 */
export interface IGenericRepository<Entity, CreateInput, UpdateInput, WhereInput, SelectInput = object> {
  findUnique(args: { where: WhereInput; select?: SelectInput }): Promise<Entity | null>;
  findFirst(args: { where: WhereInput; select?: SelectInput }): Promise<Entity | null>;
  findMany(args?: { where?: WhereInput; select?: SelectInput; orderBy?: object; take?: number; skip?: number }): Promise<Entity[]>;
  create(args: { data: CreateInput; select?: SelectInput }): Promise<Entity>;
  update(args: { where: WhereInput; data: UpdateInput; select?: SelectInput }): Promise<Entity>;
  delete(args: { where: WhereInput }): Promise<Entity>;
  count(args?: { where?: WhereInput }): Promise<number>;
}
