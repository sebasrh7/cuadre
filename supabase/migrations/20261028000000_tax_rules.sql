-- Reglas fiscales y de seguridad social por año. Nunca van en el código:
-- cada valor tiene su norma y la fuente donde se verificó.

create table public.tax_rules (
  year smallint not null,
  key text not null,
  value numeric not null,
  unit text not null check (unit in ('cop', 'uvt', 'smmlv', 'percent')),
  norm text not null,
  source_url text not null,
  verified_on date not null,
  primary key (year, key)
);

alter table public.tax_rules enable row level security;

-- Datos públicos de referencia: cualquier usuario autenticado los lee; nadie
-- los escribe desde la app (solo migraciones).
create policy "tax_rules: lectura" on public.tax_rules
  for select to authenticated using (true);

insert into public.tax_rules (year, key, value, unit, norm, source_url, verified_on) values
  (2026, 'uvt', 52374, 'cop', 'Resolución DIAN 000238 de 2025',
    'https://incp.org.co/publicaciones/infoincp-publicaciones/impuestos/2025/12/dian-fijo-en-52-374-en-valor-de-la-uvt-para-el-ano-gravable-2026/', '2026-10-27'),
  (2026, 'smmlv', 1750905, 'cop', 'Decreto 1469 de 2025',
    'https://consultorsalud.com/aumento-del-salario-minimo-en-colombia-2026/', '2026-10-27'),

  -- Topes para estar obligado a declarar renta (persona natural, año gravable 2026).
  (2026, 'renta_tope_ingresos', 1400, 'uvt', 'Estatuto Tributario arts. 592-594-3',
    'https://cijuf.org.co/sites/cijuf.org.co/files/documentos_interes/234%20VALORES%20ABSOLUTOS%20FISCALES%20UVT%20AN%CC%83O%20GRAVABLE%202026.pdf', '2026-10-27'),
  (2026, 'renta_tope_patrimonio', 4500, 'uvt', 'Estatuto Tributario arts. 592-594-3',
    'https://cijuf.org.co/sites/cijuf.org.co/files/documentos_interes/234%20VALORES%20ABSOLUTOS%20FISCALES%20UVT%20AN%CC%83O%20GRAVABLE%202026.pdf', '2026-10-27'),
  (2026, 'renta_tope_consignaciones', 1400, 'uvt', 'Estatuto Tributario art. 594-3',
    'https://cijuf.org.co/sites/cijuf.org.co/files/documentos_interes/234%20VALORES%20ABSOLUTOS%20FISCALES%20UVT%20AN%CC%83O%20GRAVABLE%202026.pdf', '2026-10-27'),
  (2026, 'renta_tope_consumos_tarjeta', 1400, 'uvt', 'Estatuto Tributario art. 594-3',
    'https://cijuf.org.co/sites/cijuf.org.co/files/documentos_interes/234%20VALORES%20ABSOLUTOS%20FISCALES%20UVT%20AN%CC%83O%20GRAVABLE%202026.pdf', '2026-10-27'),
  (2026, 'renta_tope_compras', 1400, 'uvt', 'Estatuto Tributario art. 594-3',
    'https://cijuf.org.co/sites/cijuf.org.co/files/documentos_interes/234%20VALORES%20ABSOLUTOS%20FISCALES%20UVT%20AN%CC%83O%20GRAVABLE%202026.pdf', '2026-10-27'),

  -- Seguridad social de independientes con contrato de prestación de servicios.
  (2026, 'ss_obligacion_desde', 1, 'smmlv', 'Ley 2277 de 2022 art. 89',
    'https://www.ugpp.gov.co/wp-content/uploads/2026/01/ABC-Trabajador-Independiente-Contrato-Prestacion-Servicios.pdf', '2026-10-27'),
  (2026, 'ss_ibc_porcentaje', 40, 'percent', 'UGPP, ABC trabajador independiente 2026',
    'https://www.ugpp.gov.co/wp-content/uploads/2026/01/ABC-Trabajador-Independiente-Contrato-Prestacion-Servicios.pdf', '2026-10-27'),
  (2026, 'ss_ibc_minimo', 1, 'smmlv', 'UGPP',
    'https://www.ugpp.gov.co/wp-content/uploads/2026/01/ABC-Trabajador-Independiente-Contrato-Prestacion-Servicios.pdf', '2026-10-27'),
  (2026, 'ss_ibc_maximo', 25, 'smmlv', 'UGPP',
    'https://www.ugpp.gov.co/wp-content/uploads/2026/01/ABC-Trabajador-Independiente-Contrato-Prestacion-Servicios.pdf', '2026-10-27'),
  (2026, 'ss_salud', 12.5, 'percent', 'UGPP',
    'https://www.ugpp.gov.co/wp-content/uploads/2026/01/ABC-Trabajador-Independiente-Contrato-Prestacion-Servicios.pdf', '2026-10-27'),
  (2026, 'ss_pension', 16, 'percent', 'UGPP',
    'https://www.ugpp.gov.co/wp-content/uploads/2026/01/ABC-Trabajador-Independiente-Contrato-Prestacion-Servicios.pdf', '2026-10-27'),

  -- ARL: valor inicial por clase de riesgo.
  (2026, 'arl_riesgo_1', 0.522, 'percent', 'Decreto 1772 de 1994 art. 13',
    'https://www.suin-juriscol.gov.co/viewDocument.asp?id=1347973', '2026-10-27'),
  (2026, 'arl_riesgo_2', 1.044, 'percent', 'Decreto 1772 de 1994 art. 13',
    'https://www.suin-juriscol.gov.co/viewDocument.asp?id=1347973', '2026-10-27'),
  (2026, 'arl_riesgo_3', 2.436, 'percent', 'Decreto 1772 de 1994 art. 13',
    'https://www.suin-juriscol.gov.co/viewDocument.asp?id=1347973', '2026-10-27'),
  (2026, 'arl_riesgo_4', 4.350, 'percent', 'Decreto 1772 de 1994 art. 13',
    'https://www.suin-juriscol.gov.co/viewDocument.asp?id=1347973', '2026-10-27'),
  (2026, 'arl_riesgo_5', 6.960, 'percent', 'Decreto 1772 de 1994 art. 13',
    'https://www.suin-juriscol.gov.co/viewDocument.asp?id=1347973', '2026-10-27');
