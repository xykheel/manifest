export const Department = {
  DEVELOPMENT: "DEVELOPMENT",
  LEADERSHIP: "LEADERSHIP",
  OPTIMISATION: "OPTIMISATION",
  DELIVERY: "DELIVERY",
  QUALITY_ASSURANCE: "QUALITY_ASSURANCE",
  EXPERIENCE_DESIGN: "EXPERIENCE_DESIGN",
  OTHER: "OTHER",
  SYSTEM_ADMINISTRATOR: "SYSTEM_ADMINISTRATOR",
} as const;

export type Department = (typeof Department)[keyof typeof Department];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  DEVELOPMENT: "Development",
  LEADERSHIP: "Leadership",
  OPTIMISATION: "Optimisation",
  DELIVERY: "Delivery",
  QUALITY_ASSURANCE: "Quality Assurance",
  EXPERIENCE_DESIGN: "Experience Design",
  OTHER: "Other",
  SYSTEM_ADMINISTRATOR: "System Administrator",
};

/** All assignable departments for users and programmes (excludes nothing — full list). */
export const ALL_DEPARTMENTS: readonly Department[] = [
  Department.DEVELOPMENT,
  Department.LEADERSHIP,
  Department.OPTIMISATION,
  Department.DELIVERY,
  Department.QUALITY_ASSURANCE,
  Department.EXPERIENCE_DESIGN,
  Department.OTHER,
  Department.SYSTEM_ADMINISTRATOR,
] as const;
