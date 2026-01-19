import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("users")
export class UserEntity
{
    @PrimaryColumn("varchar")
    id!: string;

    @Column("varchar", { unique: true })
    username!: string;

    @Column("varchar")
    password!: string;

    @Column("varchar")
    salt!: string;

    @Column("int", { default: 100 })
    elo!: number;
}
