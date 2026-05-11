import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class ManualTopupDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;
}
