import { AuthShell } from '@/components/admin/AuthShell';
import { ForgotForm } from '@/components/admin/ForgotForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: '¿Olvidaste tu contraseña? · Stampa' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="¿Olvidaste tu contraseña?" subtitle="Escribe tu correo y te enviamos un enlace para crear una nueva.">
      <ForgotForm />
    </AuthShell>
  );
}
