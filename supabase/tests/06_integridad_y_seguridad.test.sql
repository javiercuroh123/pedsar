begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id,email) values
 ('a6000000-0000-4000-8000-000000000001','seguridad1@pedsar.test'),
 ('a6000000-0000-4000-8000-000000000002','seguridad2@pedsar.test'),
 ('a6000000-0000-4000-8000-000000000003','seguridad3@pedsar.test');
insert into public.cursos(id,slug,titulo,precio,cupo_maximo,estado) values
 ('c6000000-0000-4000-8000-000000000001','seguridad-uno','Uno',100,1,'PUBLICADO'),
 ('c6000000-0000-4000-8000-000000000002','seguridad-dos','Dos',100,20,'PUBLICADO');
insert into public.sesiones(curso_id,fecha,hora_inicio,enlace_virtual) values
 ('c6000000-0000-4000-8000-000000000001',current_date,'19:00','https://example.test/clase-privada');

set local role anon;
select is_empty($$select enlace_virtual from public.sesiones where curso_id='c6000000-0000-4000-8000-000000000001'$$,'Visitante no obtiene enlaces');
select is((select count(*)::int from public.horarios_publicos(array['c6000000-0000-4000-8000-000000000001'::uuid])),1,'El horario sigue siendo público');
select throws_ok($$select * from public.registrar_matricula('a6000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','YAPE','',100,'{}')$$,'42501',null,'RPC de matrícula inaccesible sin servidor');
reset role;

select throws_ok($$select * from public.registrar_matricula('a6000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','YAPE','',100,null)$$,'23502',null,'Fallo del pago revierte la transacción de matrícula');
select is((select count(*)::int from public.inscripciones where curso_id='c6000000-0000-4000-8000-000000000001'),0,'No queda una inscripción huérfana');
select lives_ok($$select * from public.registrar_matricula('a6000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','YAPE','',100,'{}')$$,'Matrícula con pago creada');
select is((select count(*)::int from public.pagos p join public.inscripciones i on i.id=p.inscripcion_id where i.curso_id='c6000000-0000-4000-8000-000000000001'),1,'Pago e inscripción existen juntos');
select throws_ok($$select * from public.registrar_matricula('a6000000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000001','YAPE','',100,'{}')$$,'P0001',null,'Último cupo no admite otra reserva');

update public.inscripciones set vence_en=now()-interval '1 minute' where curso_id='c6000000-0000-4000-8000-000000000001';
select * from public.registrar_matricula('a6000000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000001','YAPE','',100,'{}');
select throws_ok($$update public.inscripciones set estado='CONFIRMADA',vence_en=null where estudiante_id='a6000000-0000-4000-8000-000000000001' and curso_id='c6000000-0000-4000-8000-000000000001'$$,'P0001',null,'Una confirmación tardía no excede el cupo');

select * from public.registrar_matricula('a6000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000002','YAPE','',100,'{}');
update public.inscripciones set estado='CONFIRMADA',vence_en=null where curso_id='c6000000-0000-4000-8000-000000000002';
insert into public.modulos(id,curso_id,titulo) overriding system value values
 (96001,'c6000000-0000-4000-8000-000000000001','Ajeno'),(96002,'c6000000-0000-4000-8000-000000000002','Propio');
insert into public.contenidos(id,modulo_id,titulo,tipo,url_archivo) overriding system value values
 (96001,96001,'Ajeno','PDF','ajeno.pdf'),(96002,96002,'Propio','PDF','propio.pdf'),(96003,96002,'Otro','PDF','otro.pdf');

select set_config('request.jwt.claims','{"sub":"a6000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$insert into public.contenidos_completados(inscripcion_id,contenido_id) select id,96001 from public.inscripciones where curso_id='c6000000-0000-4000-8000-000000000002'$$,'42501',null,'No puede completar contenido de otro curso');
select lives_ok($$insert into public.contenidos_completados(inscripcion_id,contenido_id) select id,96002 from public.inscripciones where curso_id='c6000000-0000-4000-8000-000000000002'$$,'Puede completar su contenido');
select is((select porcentaje from public.progreso p join public.inscripciones i on i.id=p.inscripcion_id where i.curso_id='c6000000-0000-4000-8000-000000000002'),50.00::numeric,'El trigger calcula el progreso real');
reset role;
-- HU-10 · El progreso se recalcula automáticamente al agregar o quitar contenidos o módulos.
insert into public.contenidos(id,modulo_id,titulo,tipo,url_archivo) overriding system value values
 (96004,96002,'Tercero','PDF','tercero.pdf'),(96005,96002,'Cuarto','PDF','cuarto.pdf');
select is((select porcentaje from public.progreso p join public.inscripciones i on i.id=p.inscripcion_id where i.curso_id='c6000000-0000-4000-8000-000000000002'),25.00::numeric,'Agregar contenidos recalcula el porcentaje de progreso');
delete from public.contenidos where id in (96004,96005);
select is((select porcentaje from public.progreso p join public.inscripciones i on i.id=p.inscripcion_id where i.curso_id='c6000000-0000-4000-8000-000000000002'),50.00::numeric,'Eliminar contenidos recalcula el porcentaje de progreso');
select set_config('request.jwt.claims','{}',true);
update public.perfiles set estado=false where id='a6000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"a6000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is_empty($$select id from public.inscripciones$$,'Una sesión antigua no permite leer matrículas después de la baja');
select throws_ok($$insert into public.contenidos_completados(inscripcion_id,contenido_id) values ((select id from public.inscripciones limit 1),96003)$$,'42501',null,'La cuenta desactivada no escribe');
reset role;
select set_config('request.jwt.claims','{}',true);
update public.perfiles set estado=true where id='a6000000-0000-4000-8000-000000000001';

insert into public.evaluaciones(id,curso_id,titulo,tiempo_limite_min,intentos_permitidos) overriding system value values
 (96001,'c6000000-0000-4000-8000-000000000002','Prueba',1,2);
insert into public.preguntas(id,evaluacion_id,enunciado,opciones,respuesta_correcta,puntaje) overriding system value values
 (96001,96001,'Capital','["Lima","Cusco"]','Lima',1);
select throws_ok($$select * from public.entregar_evaluacion('a6000000-0000-4000-8000-000000000001',96001,1,'{"96001":"Lima"}')$$,'P0001','Inicia la evaluación antes de entregar','No se entregan respuestas sin iniciar plazo');
create temp table primer_inicio as select * from public.iniciar_evaluacion('a6000000-0000-4000-8000-000000000001',96001);
select is((select vence_en from public.iniciar_evaluacion('a6000000-0000-4000-8000-000000000001',96001)),(select vence_en from primer_inicio),'Recargar conserva el mismo vencimiento');
select is((select puntaje from public.entregar_evaluacion('a6000000-0000-4000-8000-000000000001',96001,1,'{"96001":"Lima"}')),20.00::numeric,'Califica automáticamente en la BD');
select is((select puntaje from public.entregar_evaluacion('a6000000-0000-4000-8000-000000000001',96001,1,'{"96001":"Cusco"}')),20.00::numeric,'Repetir una entrega conserva su resultado');
select is((select count(*)::int from public.intentos_evaluacion where evaluacion_id=96001),1,'Entrega duplicada no consume otro intento');
select * from public.iniciar_evaluacion('a6000000-0000-4000-8000-000000000001',96001);
update public.evaluaciones_en_curso set vence_en=now()-interval '10 seconds' where evaluacion_id=96001;
select is((select puntaje from public.entregar_evaluacion('a6000000-0000-4000-8000-000000000001',96001,2,'{"96001":"Lima"}')),0::numeric,'Una respuesta tardía no obtiene puntos');
select throws_ok($$select * from public.iniciar_evaluacion('a6000000-0000-4000-8000-000000000001',96001)$$,'P0001','Ya usaste todos tus intentos','El intento vencido consume su oportunidad');

-- Cierre financiero atómico, sin afirmar una entrega ante un fallo intermedio.
update public.perfiles set rol='administrador' where id='a6000000-0000-4000-8000-000000000003';
update public.pagos set estado='APROBADO' where inscripcion_id in (select id from public.inscripciones where curso_id='c6000000-0000-4000-8000-000000000002');
insert into public.reembolsos(id,pago_id,motivo,monto,estado) overriding system value
 select 96001,p.id,'Devolución de prueba',p.monto,'APROBADO' from public.pagos p join public.inscripciones i on i.id=p.inscripcion_id where i.curso_id='c6000000-0000-4000-8000-000000000002';
select throws_ok($$select public.finalizar_reembolso(96001,'a6000000-0000-4000-8000-000000000001')$$,'42501',null,'Solo un administrador activo confirma la entrega');
create function pg_temp.impedir_cierre() returns trigger language plpgsql as $$ begin raise exception 'Fallo simulado'; end $$;
create trigger prueba_fallo before update on public.inscripciones for each row execute function pg_temp.impedir_cierre();
select throws_ok($$select public.finalizar_reembolso(96001,'a6000000-0000-4000-8000-000000000003')$$,'P0001','Fallo simulado','Un fallo de matrícula revierte el cierre');
select is((select p.estado::text from public.pagos p join public.reembolsos r on r.pago_id=p.id where r.id=96001),'APROBADO','El pago tampoco quedó reembolsado a medias');
select is((select estado::text from public.reembolsos where id=96001),'APROBADO','La solicitud sigue pendiente de cierre');
drop trigger prueba_fallo on public.inscripciones;
select ok(public.finalizar_reembolso(96001,'a6000000-0000-4000-8000-000000000003'),'Se registra la entrega');
select is((select p.estado::text from public.pagos p join public.reembolsos r on r.pago_id=p.id where r.id=96001),'REEMBOLSADO','Pago devuelto');
select is((select i.estado::text from public.inscripciones i join public.pagos p on p.inscripcion_id=i.id join public.reembolsos r on r.pago_id=p.id where r.id=96001),'CANCELADA','Matrícula cancelada junto al pago');
select ok(public.finalizar_reembolso(96001,'a6000000-0000-4000-8000-000000000003'),'Repetir el cierre es idempotente');

insert into public.cupones(codigo,porcentaje_descuento,fecha_vigencia,usos_maximos) values('SEGURIDAD10',10,current_date+1,1);
select lives_ok($$select * from public.registrar_matricula('a6000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000002','YAPE','SEGURIDAD10',90,'{}')$$,'Cupón reserva un uso');
select throws_ok($$select * from public.registrar_matricula('a6000000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000002','YAPE','SEGURIDAD10',90,'{}')$$,'22023',null,'El cupón con último uso reservado no se reutiliza');
update public.inscripciones set vence_en=now()-interval '1 second' where estado='PENDIENTE' and curso_id='c6000000-0000-4000-8000-000000000002';
select lives_ok($$select * from public.registrar_matricula('a6000000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000002','YAPE','SEGURIDAD10',90,'{}')$$,'El vencimiento libera el uso del cupón');

-- HU-49 · Consentimiento de política de privacidad persistido al crear usuario.
insert into auth.users(id,email,raw_user_meta_data) values
 ('a6000000-0000-4000-8000-000000000004','privacidad@pedsar.test','{"nombres":"Carla","apellidos":"Díaz","privacidad_version":"2026-10","privacidad_aceptada_en":"2026-10-05T14:00:00Z"}');
select is((select privacidad_version from public.perfiles where id='a6000000-0000-4000-8000-000000000004'),'2026-10','Guarda la versión aceptada de la política de privacidad');
select ok((select privacidad_aceptada_en is not null from public.perfiles where id='a6000000-0000-4000-8000-000000000004'),'Guarda la fecha y hora de aceptación de privacidad');

-- HU-57 · Publicación automática de cursos programados.
insert into public.cursos(id,slug,titulo,precio,cupo_maximo,estado,publicar_en) values
 ('c6000000-0000-4000-8000-000000000003','programado-listo','Programado listo',100,20,'BORRADOR',now()-interval '5 minutes'),
 ('c6000000-0000-4000-8000-000000000004','programado-futuro','Programado futuro',100,20,'BORRADOR',now()+interval '1 day');
select is(privado.publicar_cursos_programados(),1,'Publica únicamente los cursos cuyo publicar_en ya venció');
select is((select estado::text from public.cursos where id='c6000000-0000-4000-8000-000000000003'),'PUBLICADO','El curso programado vencido pasa a PUBLICADO');
select is((select estado::text from public.cursos where id='c6000000-0000-4000-8000-000000000004'),'BORRADOR','El curso con fecha futura permanece en BORRADOR');

-- RNF-02 · Consulta por lotes de cupos disponibles.
select is((select count(*)::int from public.cupos_disponibles(array['c6000000-0000-4000-8000-000000000001'::uuid,'c6000000-0000-4000-8000-000000000002'::uuid])),2,'cupos_disponibles devuelve el cupo de múltiples cursos en una sola consulta');

-- RNF-04 · Control de máximo 2 sesiones concurrentes al registrar INICIO_SESION.
select lives_ok($$insert into public.registro_actividad(usuario_id,accion) values ('a6000000-0000-4000-8000-000000000004','INICIO_SESION')$$,'El trigger de inicio de sesión aplica el límite de sesiones concurrentes');

-- HU-22 · HU-23 · Foro y preguntas por lección restringidos a participantes del curso.
update public.inscripciones set estado='CONFIRMADA',vence_en=null where estudiante_id='a6000000-0000-4000-8000-000000000002' and curso_id='c6000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{"sub":"a6000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$insert into public.foro_temas(curso_id,contenido_id,autor_id,titulo,cuerpo) values ('c6000000-0000-4000-8000-000000000002',96002,'a6000000-0000-4000-8000-000000000002','Pregunta de lección','¿Cómo funciona este módulo?')$$,'Estudiante inscrito puede publicar pregunta en su lección');
select throws_ok($$insert into public.foro_temas(curso_id,contenido_id,autor_id,titulo,cuerpo) values ('c6000000-0000-4000-8000-000000000002',96001,'a6000000-0000-4000-8000-000000000002','Contenido ajeno','No pertenece al curso')$$,'42501',null,'No permite asociar pregunta a un contenido de otro curso');
reset role;
select set_config('request.jwt.claims','{"sub":"a6000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is_empty($$select id from public.foro_temas where curso_id='c6000000-0000-4000-8000-000000000002'$$,'Usuario no inscrito no puede leer el foro del curso');
reset role;
select * from finish();
rollback;
