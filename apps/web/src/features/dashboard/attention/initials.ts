/** «SR» de «Sofía Rojas». */
export const initialsFromName = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("") || "?";
