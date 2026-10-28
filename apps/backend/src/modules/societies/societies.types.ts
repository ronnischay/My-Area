export interface Society {
  id: string;
  name: string;
  addressText: string;
  createdAt: Date;
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
