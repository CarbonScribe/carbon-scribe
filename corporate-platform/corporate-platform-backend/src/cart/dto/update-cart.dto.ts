import { IsInt, Min } from 'class-validator';

export class UpdateCartDto {
  @IsInt()
  @Min(1)
  quantity: number;
}
