INSERT INTO public.rubros (nombre, slug, icono, orden) VALUES
('Almacenes y despensas', 'almacenes-despensas', 'ShoppingBag', 1),
('Supermercados', 'supermercados', 'ShoppingCart', 2),
('Panaderías', 'panaderias', 'Utensils', 3),
('Carnicerías', 'carnicerias', 'Beef', 4),
('Rotiserías y restaurantes', 'rotiserias-restaurantes', 'UtensilsCrossed', 5),
('Cafeterías y bares', 'cafeterias-bares', 'Coffee', 6),
('Farmacias', 'farmacias', 'Pill', 7),
('Indumentaria', 'indumentaria', 'Shirt', 8),
('Ferreterías', 'ferreterias', 'Wrench', 9),
('Otros', 'otros', 'MoreHorizontal', 10);

INSERT INTO public.planes (nombre, precio_mensual, limite_promociones)
VALUES ('Plan Estándar Comercio', 10000.00, 5);