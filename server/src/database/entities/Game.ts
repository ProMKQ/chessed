import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity("games")
export class GameEntity
{
    @PrimaryGeneratedColumn()
    id!: number;

    @Column("varchar")
    whiteUserId!: string;

    @Column("varchar")
    blackUserId!: string;

    @Column("text")
    result!: string;
}
