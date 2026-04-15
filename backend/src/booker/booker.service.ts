import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booker } from '../entities/booker.entity';

@Injectable()
export class BookerService {
  constructor(
    @InjectRepository(Booker)
    private bookerRepository: Repository<Booker>,
  ) {}

  async create(data: { name: string; contact: string }): Promise<Booker> {
    return await this.bookerRepository.save(
      this.bookerRepository.create(data),
    );
  }

  async findOne(id: number): Promise<Booker> {
    return await this.bookerRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<Booker[]> {
    return await this.bookerRepository.find();
  }
}
