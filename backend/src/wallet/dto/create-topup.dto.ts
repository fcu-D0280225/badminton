import { IsNumber, Min } from 'class-validator';

export class CreateTopupDto {
  @IsNumber()
  @Min(1)
  amount: number;
}
