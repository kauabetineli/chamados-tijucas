import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

/**
 * Campo de senha com "Mostrar". No celular a senha provisória (ex.: K7mPq2) é digitada olhando o bilhete:
 * sem ver o que digitou, a pessoa erra e não sabe onde. O botão não rouba o foco do campo.
 */
export function CampoSenha({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={ver ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} className={`campo pr-14 ${className}`} />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? "Esconder a senha" : "Mostrar a senha"}
        aria-pressed={ver}
        aria-controls={props.id}
        className="absolute inset-y-0 right-1 my-auto grid size-11 place-items-center rounded-lg text-tinta-2 hover:text-tinta"
      >
        {ver ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
      </button>
    </div>
  );
}
