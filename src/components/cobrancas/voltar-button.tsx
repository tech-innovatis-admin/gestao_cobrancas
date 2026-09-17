"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const VoltarButton = () => {
  const router = useRouter();
  return <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft size={14} /> Voltar</Button>;
};
