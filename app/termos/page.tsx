export const metadata = { title: "Termos de uso — Alguém Indica" };
export default function Termos() {
  return (
    <main className="prose mx-auto max-w-2xl space-y-3 p-6 leading-relaxed">
      <h1 className="text-2xl font-bold">Termos de uso</h1>
      <p className="text-sm text-navy/60">Modelo inicial — revise com um advogado antes de lançar em escala.</p>
      <h2 className="text-lg font-semibold">1. O que é o Alguém Indica</h2>
      <p>Plataforma que reúne indicações de prestadores de serviço feitas por moradores de um mesmo condomínio. O Alguém Indica não presta nem intermedeia os serviços, não é parte da contratação e não garante a qualidade, o preço ou a idoneidade de nenhum profissional.</p>
      <h2 className="text-lg font-semibold">2. Responsabilidades do usuário</h2>
      <ul className="list-disc pl-6">
        <li>Fornecer informações verdadeiras no cadastro.</li>
        <li>Indicar apenas profissionais cujo contato você tem autorização para divulgar.</li>
        <li>Publicar avaliações baseadas em experiência real, sem ofensas, discriminação ou dados pessoais de terceiros.</li>
        <li>Uma avaliação por profissional, uma conta por pessoa.</li>
      </ul>
      <h2 className="text-lg font-semibold">3. Moderação</h2>
      <p>Conteúdos podem ser ocultados ou removidos pela administração, especialmente quando denunciados ou considerados duplicados, falsos ou ofensivos. Contas que violem estes termos podem ser suspensas.</p>
      <h2 className="text-lg font-semibold">4. Limitação de responsabilidade</h2>
      <p>A contratação é feita diretamente entre morador e profissional, por conta e risco das partes. Recomendamos conferir referências e combinar valores e condições antes do serviço.</p>
      <h2 className="text-lg font-semibold">5. Alterações</h2>
      <p>Estes termos podem ser atualizados; o uso continuado indica concordância.</p>
      <p><a href="/privacidade" className="underline">Política de Privacidade</a></p>
    </main>
  );
}
