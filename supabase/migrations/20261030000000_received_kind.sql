-- Lo que entra de una persona (o un abono sin identificar) no siempre es un
-- ingreso: puede ser una deuda que le pagan al usuario o efectivo que le
-- cambiaron por transferencia. Queda como 'received' hasta que el usuario lo
-- marque como ingreso. Las consignaciones para la DIAN lo siguen contando.
alter table public.movements drop constraint movements_kind_check;
alter table public.movements
  add constraint movements_kind_check check (kind in ('income', 'expense', 'own_transfer', 'received'));

-- Ingresos ya importados que no son giros ni intereses (esos llevan categoría).
update public.movements
set kind = 'received'
where kind = 'income'
  and direction = 'in'
  and category is null
  and source in ('statement', 'alert');
