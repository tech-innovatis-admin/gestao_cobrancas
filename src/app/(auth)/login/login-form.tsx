"use client";
import { startTransition, useActionState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginAction, type FormState } from "@/services/authActions";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Erro } from "@/components/ui/basicos";

export const LoginForm = ({ next, aviso }: { next: string; aviso?: string }) => {
  const [state, formAction, pending] = useActionState<FormState, FormData>(loginAction, {});
  const { control, handleSubmit } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", senha: "" } });

  const onValid = (data: LoginInput) => {
    const fd = new FormData();
    fd.set("email", data.email);
    fd.set("senha", data.senha);
    fd.set("next", next);
    startTransition(() => formAction(fd));
  };

  return (
    <form onSubmit={handleSubmit(onValid)} className="w-full max-w-sm space-y-4 rounded-lg border p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Entrar</h2>
        <p className="text-sm text-muted-foreground">Use seu e-mail corporativo.</p>
      </div>
      <FieldGroup>
        <Controller control={control} name="email" render={({ field, fieldState }) => (
          <Field data-invalid={!!fieldState.error}>
            <FieldLabel htmlFor={field.name}>E-mail</FieldLabel>
            <Input id={field.name} type="email" autoComplete="email" aria-invalid={!!fieldState.error} {...field} />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )} />
        <Controller control={control} name="senha" render={({ field, fieldState }) => (
          <Field data-invalid={!!fieldState.error}>
            <FieldLabel htmlFor={field.name}>Senha</FieldLabel>
            <Input id={field.name} type="password" autoComplete="current-password" aria-invalid={!!fieldState.error} {...field} />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )} />
      </FieldGroup>
      <Erro msg={state.erro ?? aviso} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</Button>
    </form>
  );
};
