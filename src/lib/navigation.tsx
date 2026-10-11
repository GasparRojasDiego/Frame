// Capa de navegación de Frame: API compatible con la usada en Aether OS
// (next/link y next/navigation) implementada sobre react-router.
// Mantiene idénticas las llamadas de las vistas y elimina el framework SSR.
import * as React from 'react';
import {
  Link as RouterLink,
  useNavigate,
  useLocation,
  useSearchParams as useRouterSearchParams,
} from 'react-router-dom';

export interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children?: React.ReactNode;
}

// <Link href="..."> con la misma firma que next/link.
const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(({ href, children, ...props }, ref) => (
  <RouterLink to={href} ref={ref} {...props}>
    {children}
  </RouterLink>
));
Link.displayName = 'Link';
export default Link;

// useRouter con la superficie que consume la app (push/replace/back).
// El segundo argumento ({ scroll }) existía en Next; aquí se acepta y se
// ignora porque la SPA no aplica scroll-restoration automático.
export function useRouter() {
  const navigate = useNavigate();
  return React.useMemo(
    () => ({
      push: (href: string, _opts?: { scroll?: boolean }) => navigate(href),
      replace: (href: string, _opts?: { scroll?: boolean }) => navigate(href, { replace: true }),
      back: () => navigate(-1),
      forward: () => navigate(1),
    }),
    [navigate]
  );
}

export function usePathname(): string {
  return useLocation().pathname;
}

// useSearchParams de solo lectura, como en next/navigation.
export function useSearchParams(): URLSearchParams {
  const [params] = useRouterSearchParams();
  return params;
}
