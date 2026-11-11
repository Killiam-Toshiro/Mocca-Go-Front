'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ROLE_FILTERS, type RoleFilter } from '@/lib/users/roles';

/** Búsqueda (usuario, nombre, teléfono o correo) y filtro por rol; ambos los resuelve el servidor. */
export function UsersFilters({
  search,
  role,
  onSearch,
  onRole,
}: {
  search: string;
  role: RoleFilter;
  onSearch: (value: string) => void;
  onRole: (value: RoleFilter) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="grid gap-1.5">
        <Label htmlFor="users-search">Buscar usuario</Label>
        <Input
          id="users-search"
          type="search"
          className="h-11"
          placeholder="Usuario, nombre, teléfono o correo"
          maxLength={100}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          aria-describedby="users-search-hint"
        />
        <p id="users-search-hint" className="text-sm text-muted-foreground">
          La búsqueda distingue tildes.
        </p>
      </div>
      <div className="grid content-start gap-1.5">
        <Label htmlFor="users-role">Rol</Label>
        <Select
          id="users-role"
          value={role}
          onChange={(e) => onRole(e.target.value as RoleFilter)}
        >
          {ROLE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
