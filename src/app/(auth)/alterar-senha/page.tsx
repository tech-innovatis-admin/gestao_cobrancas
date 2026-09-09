"use client";
import { startTransition, useActionState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { alterarSenhaAction, type FormState } from "@/services/authActions";
import { alterarSenhaSchema, type AlterarSenhaInput } from "@/lib/schemas/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Erro } from "@/components/ui/basicos";

export default function AlterarSenhaPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(alterarSenhaAction, {});
  const { control, handleSubmit } = useForm<AlterarSenhaInput>({ resolver: zodResolver(alterarSenhaSchema), defaultValues: { senha: "", confirmar: "" } });

  const onValid = (data: AlterarSenhaInput) => {
    const fd = new FormData();
    fd.set("senha", data.senha);
    fd.set("confirmar", data.confirmar);
    startTransition(() => formAction(fd));
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <form onSubmit={handleSubmit(onValid)} className="w-full max-w-sm space-y-4 rounded-lg border p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold">Defina sua nova senha</h2>
          <p className="text-sm text-muted-foreground">Por segurança, a senha temporária precisa ser substituída no primeiro acesso.</p>
        </div>
        <FieldGroup>
          <Controller control={control} name="senha" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor={field.name}>Nova senha</FieldLabel>
              <Input id={field.name} type="password" autoComplete="new-password" aria-invalid={!!fieldState.error} {...field} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )} />
          <Controller control={control} name="confirmar" render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor={field.name}>Confirmar</FieldLabel>
              <Input id={field.name} type="password" autoComplete="new-password" aria-invalid={!!fieldState.error} {...field} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )} />
        </FieldGroup>
        <Erro msg={state.erro} />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "Salvando…" : "Salvar e continuar"}</Button>
      </form>
    </main>
  );
}
