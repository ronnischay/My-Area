export interface Society {
  id: string;
  name: string;
  addressText: string;
  createdAt: Date;
}

/** A society in the admin's list, with how many people it has (any status). */
export interface SocietySummary extends Society {
  managerCount: number;
  residentCount: number;
}

export interface SocietyInput {
  name: string;
  addressText: string;
}

/** `Society` in the API contract. */
export interface SocietyDto {
  id: string;
  name: string;
  addressText: string;
  createdAt: string;
}

export function toSocietyDto(society: Society): SocietyDto {
  return {
    id: society.id,
    name: society.name,
    addressText: society.addressText,
    createdAt: society.createdAt.toISOString(),
  };
}

/** `SocietySummary` in the API contract. */
export function toSocietySummaryDto(society: SocietySummary): SocietyDto & { managerCount: number; residentCount: number } {
  return { ...toSocietyDto(society), managerCount: society.managerCount, residentCount: society.residentCount };
}
