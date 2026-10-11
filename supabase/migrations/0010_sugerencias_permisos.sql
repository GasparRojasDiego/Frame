-- ============================================================
-- 0010 · Sugerencias: solo el responsable lee.
--
-- 0009 quitó el permiso a PUBLIC, pero Supabase concede además EXECUTE a
-- `anon` y `authenticated` por defecto al crear cada función, así que las
-- tres funciones del buzón quedaban invocables sin sesión. Dentro ya
-- comprobaban que quien llama es el responsable (auth.uid()), de modo que no
-- devolvían nada a nadie más; esto lo cierra también en los permisos.
--
-- `feedback_submit` sigue abierta a `anon`: los invitados de Frame no tienen
-- sesión de Supabase y también pueden enviar sugerencias.
-- ============================================================

revoke execute on function public.feedback_list() from anon;
revoke execute on function public.feedback_unread_count() from anon;
revoke execute on function public.feedback_mark_read() from anon;
