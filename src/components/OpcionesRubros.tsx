import React from 'react';
import { Rubro } from '@/types/database.types';
import { agruparRubros } from '@/lib/catalogoRubros';

// <option> de rubros agrupados por categoría (<optgroup>), para cualquier <select>.
// Con más de 150 rubros, una lista plana es imposible de recorrer.
export const OpcionesRubros: React.FC<{ rubros: Pick<Rubro, 'id' | 'nombre' | 'slug'>[] }> = ({ rubros }) => (
  <>
    {agruparRubros(rubros).map(({ categoria, rubros: grupo }) => (
      <optgroup key={categoria} label={categoria}>
        {grupo.map((r) => (
          <option key={r.id} value={r.id}>
            {r.nombre}
          </option>
        ))}
      </optgroup>
    ))}
  </>
);
