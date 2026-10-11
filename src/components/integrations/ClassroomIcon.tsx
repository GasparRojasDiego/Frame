// Logotipo de Google Classroom (pizarra verde con marco amarillo y tres
// figuras), con los colores del branding de Google. SVG inline sin ids: puede
// montarse varias veces sin colisiones.
export function ClassroomLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 192 192" className={className} aria-hidden>
      <path fill="#0F9D58" d="M32 44h128v104H32z" />
      <circle cx="128" cy="91" r="9" fill="#57BB8A" />
      <path fill="#57BB8A" d="M128 106c-9.1 0-20 4.4-20 10.3V124h40v-7.7c0-5.9-10.9-10.3-20-10.3z" />
      <circle cx="64" cy="91" r="9" fill="#57BB8A" />
      <path fill="#57BB8A" d="M64 106c-9.1 0-20 4.4-20 10.3V124h40v-7.7c0-5.9-10.9-10.3-20-10.3z" />
      <circle cx="96" cy="82" r="12" fill="#F7F7F7" />
      <path fill="#F7F7F7" d="M96 100c-12.1 0-28 5.9-28 13.8V124h56v-10.2c0-7.9-15.9-13.8-28-13.8z" />
      <path fill="#F1F1F1" d="M116 148h40v12h-40z" />
      <path
        fill="#F4B400"
        d="M160 32H32c-6.6 0-12 5.4-12 12v104c0 6.6 5.4 12 12 12h84v-12H32V44h128v104h-4v12h4c6.6 0 12-5.4 12-12V44c0-6.6-5.4-12-12-12z"
      />
    </svg>
  );
}

// Ícono del sidebar para la interfaz Classroom.
export function ClassroomNavIcon({ className }: { className?: string }) {
  return <ClassroomLogo className={className} />;
}
