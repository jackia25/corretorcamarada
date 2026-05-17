## Plano

Vou transformar a importação em um fluxo com validação prévia, para você não precisar conferir imóvel por imóvel depois.

### 1. Criar um mapeamento explícito por perfil de origem
- Detectar automaticamente quando o XML é da Lemos/Houzez customizado.
- Para Lemos, tratar:
  - `fave_property_bathrooms` como **Suíte** quando existir `fave_banheiros`.
  - `fave_banheiros` como **Banheiros**.
  - `fave_condomc3ado` como **nome da Propriedade/Condomínio** quando for texto.
  - `fave_valor-do-condomc3adnio` como **Valor do Condomínio**.
- Manter fallback Houzez padrão para XMLs que não tenham os campos customizados da Lemos.

### 2. Adicionar uma etapa de “Pré-validação” antes do botão importar
Depois de analisar o XML, a tela vai mostrar um relatório de paridade com os campos principais:
- ID do imóvel
- Tipo
- Dormitórios
- Suítes
- Banheiros
- Garagens
- Área construída
- Preço
- Situação
- Propriedade/Condomínio
- Valor do condomínio
- IPTU, quando houver

### 3. Bloquear a importação se houver inconsistência crítica
A importação só ficará liberada se os imóveis passarem na validação de mapeamento.
Exemplos de bloqueio:
- XML contém campo de suíte, mas o imóvel parseado ficou sem suíte.
- XML contém `fave_banheiros`, mas banheiro foi importado de outro campo.
- Valor textual de condomínio foi interpretado como valor financeiro.
- ID externo ausente ou duplicado.
- Campos numéricos convertidos para `null` mesmo existindo na origem.

### 4. Exibir amostras auditáveis antes de importar
Na própria tela de importação, mostrar alguns imóveis de amostra, incluindo HZ0007, com duas colunas:
- **Origem/XML detectado**
- **Como será salvo na plataforma**

Assim você consegue ver o match antes de gravar, sem abrir cada imóvel depois.

### 5. Reforçar validação no backend da importação
A função `import-houzez-xml` também passará a validar o payload recebido antes de salvar:
- rejeitar lote com campos obrigatórios inconsistentes;
- registrar erros por imóvel;
- impedir que dados sensíveis ou campos críticos sejam sobrescritos com `null` por falha de parser.

### 6. Reimportar com segurança
Após aprovado e implementado:
- você analisa o XML;
- confere o relatório de pré-validação;
- se estiver sem erros críticos, reimporta;
- os imóveis existentes serão atualizados sem duplicar por `source_id`.

## Resultado esperado para o HZ0007
- Visão geral: **Apartamento · 2 Dormitórios · 1 Suíte · 2 Garagens · 79 m²**
- Detalhes: **Suíte 1**, **Banheiros 2**, **Propriedade Condomínio Soho Tamboré**, **Valor do Condomínio R$ 1.300**

## Arquivos que serão alterados
- `src/pages/ImportHouzezXml.tsx`
- `supabase/functions/import-houzez-xml/index.ts`
- Se necessário, pequenos ajustes em `src/pages/PropertyDetail.tsx` apenas para garantir que os campos já importados apareçam corretamente.