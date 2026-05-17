## Problema

Descrições importadas do Houzez estão salvas como HTML cru (`<strong data-start="...">`, `<ul>`, `<li>`, `&aacute;`, etc.). Quem edita vê uma sopa de tags em vez de texto.

## Solução

Converter HTML → texto com markdown leve (`**negrito**`, `- item`, quebras de linha) em 3 pontos:

### 1. Importação (`src/pages/ImportHouzezXml.tsx`)
Criar função `htmlToPlainText(html)` que:
- Substitui `<strong>`/`<b>` por `**texto**`
- Substitui `<em>`/`<i>` por `*texto*`
- Substitui `<li>` por `- item\n`
- Substitui `<p>`, `<br>`, `</div>` por quebras de linha
- Remove `data-*`, `class`, `style` e qualquer tag restante
- Decodifica entidades HTML (`&aacute;`→`á`, `&nbsp;`→espaço, `&amp;`→`&`, etc.)
- Colapsa múltiplas quebras de linha (máx 2 seguidas)

Aplicar a `description` antes de fazer upsert no banco.

### 2. Tela de edição (`src/pages/EditProperty.tsx`)
Sanitização defensiva: ao carregar o formulário, se a descrição contém `<` seguido de letra, passa pelo mesmo `htmlToPlainText`. Garante que descrições legadas não voltem a aparecer com tags mesmo sem reimportar.

### 3. Limpeza dos 288 imóveis já importados
Migration única que aplica a mesma conversão via SQL (regex `regexp_replace`) nas descrições existentes onde `description ~ '<[a-z]'`. Função PL/pgSQL roda uma vez e é descartada depois.

## Compatibilidade com a tela de detalhes

A tela de detalhes do imóvel já entende `**negrito**` e listas com `- `, então o texto convertido vai renderizar formatado corretamente sem nenhuma mudança extra lá.

## Arquivos alterados

- `src/pages/ImportHouzezXml.tsx` — adicionar `htmlToPlainText` e chamar antes do upsert
- `src/lib/htmlToPlainText.ts` (novo) — função reutilizável
- `src/pages/EditProperty.tsx` — sanitização defensiva no load
- Migration SQL — limpar 288 descrições existentes

## Resultado (exemplo HZ0007)

Antes:
```
<strong data-start="260">Condomínio Soho Tamboré</strong>, ideal...
<ul><li>3 dormitórios</li><li>2 vagas</li></ul>
```

Depois:
```
**Condomínio Soho Tamboré**, ideal...

- 3 dormitórios
- 2 vagas
```
