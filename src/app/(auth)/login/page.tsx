import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-blue-600">Cityads</h1>
        <p className="mt-2 text-sm text-gray-600">Affiliate Network Operations Tool</p>
      </div>
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h2 className="mb-6 text-xl font-semibold text-gray-900">Đăng nhập</h2>
        <LoginForm />
      </div>
    </div>
  );
}
