import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma.service';
import { CompanyRepository } from './company.repository';

describe('CompanyRepository', () => {
  let repository: CompanyRepository;

  const mockPrisma = {
    company: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repository = module.get<CompanyRepository>(CompanyRepository);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findById', () => {
    it('calls findUnique with id and optional include', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'c1', name: 'Acme' });
      await repository.findById('c1');
      expect(mockPrisma.company.findUnique).toHaveBeenCalledWith({ where: { id: 'c1' }, include: undefined });
    });
  });

  describe('listByCompanyIds', () => {
    it('calls findMany with company ids and orderBy', async () => {
      mockPrisma.company.findMany.mockResolvedValue([]);
      await repository.listByCompanyIds(['c1', 'c2']);
      expect(mockPrisma.company.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['c1', 'c2'] } },
        orderBy: { name: 'asc' },
      });
    });
  });
});
