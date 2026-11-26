-- HU-56 · Justificar faltas con motivo
--
-- Nuevo estado JUSTIFICADA con su motivo. Por decisión de PEDSAR, una falta
-- justificada cuenta como asistencia para el 75 % que exige el certificado:
-- public.resultado_academico() ya cuenta como presentes todas las marcas
-- distintas de AUSENTE, así que la fórmula no cambia.

alter type public.estado_asistencia add value if not exists 'JUSTIFICADA';

alter table public.asistencias add column if not exists motivo text;

-- El motivo es obligatorio (3 a 300 caracteres) solo en las faltas justificadas.
-- Se compara como texto: el valor nuevo del enum no se puede usar en la misma transacción.
alter table public.asistencias drop constraint if exists asistencias_motivo_justificada;
alter table public.asistencias add constraint asistencias_motivo_justificada check (
  case when estado::text = 'JUSTIFICADA'
       then char_length(btrim(coalesce(motivo, ''))) between 3 and 300
       else motivo is null
  end
);

comment on column public.asistencias.motivo is 'HU-56 · Motivo de la falta justificada (solo con estado JUSTIFICADA).';
