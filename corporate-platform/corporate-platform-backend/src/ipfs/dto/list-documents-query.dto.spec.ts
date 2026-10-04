import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ListDocumentsQueryDto } from './list-documents-query.dto';

describe('ListDocumentsQueryDto', () => {
  it('validates successfully when no query params are provided', async () => {
    const dto = plainToInstance(ListDocumentsQueryDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('validates successfully with valid page and limit values', async () => {
    const dto = plainToInstance(ListDocumentsQueryDto, {
      page: '2',
      limit: '50',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
  });

  it('rejects limit exceeding maximum allowed bound of 100', async () => {
    const dto = plainToInstance(ListDocumentsQueryDto, {
      page: '1',
      limit: '150',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const limitError = errors.find((e) => e.property === 'limit');
    expect(limitError).toBeDefined();
    expect(limitError?.constraints?.max).toBeDefined();
  });

  it('rejects non-numeric page and limit values', async () => {
    const dto = plainToInstance(ListDocumentsQueryDto, {
      page: 'invalid',
      limit: 'abc',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(2);
    const pageError = errors.find((e) => e.property === 'page');
    const limitError = errors.find((e) => e.property === 'limit');
    expect(pageError?.constraints?.isInt).toBeDefined();
    expect(limitError?.constraints?.isInt).toBeDefined();
  });

  it('rejects zero or negative page and limit values', async () => {
    const dto = plainToInstance(ListDocumentsQueryDto, {
      page: '0',
      limit: '-5',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(2);
    const pageError = errors.find((e) => e.property === 'page');
    const limitError = errors.find((e) => e.property === 'limit');
    expect(pageError?.constraints?.min).toBeDefined();
    expect(limitError?.constraints?.min).toBeDefined();
  });
});
