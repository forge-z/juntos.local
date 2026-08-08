/* ══════════════════════════════════════════════
   juntos.cash — Contenido de ayuda: Español
   Tutorial, FAQ, consejos financieros y guía de financiamientos.
   Traducido de helpContent.pt-BR.js (fuente de la verdad).
   ══════════════════════════════════════════════ */

export const TUTORIAL_STEPS = [
  {
    icon: 'house-line',
    title: 'Crea o únete a un hogar',
    text: 'Un "hogar" es el espacio donde tú y tu pareja organizan las finanzas juntos. Quien crea el hogar recibe un código de invitación; la otra persona solo necesita ingresar ese código para unirse. Si tu pareja no quiere crear una cuenta todavía, puedes agregarla como pareja manual en Ajustes.',
  },
  {
    icon: 'coins',
    title: 'Ingresa el ingreso de cada uno',
    text: 'En Ajustes, cada persona registra su propio ingreso mensual. Ese número es el que la app usa para calcular la división proporcional de los gastos, así que vale la pena mantenerlo actualizado cuando cambie el salario.',
  },
  {
    icon: 'credit-card',
    title: 'Registra los gastos de la pareja',
    text: 'En la pestaña Gastos, registra cada gasto con monto, categoría y quién pagó. Elige cómo debe dividirse: proporcional al ingreso, 50/50 o solo de una persona (individual). La app calcula automáticamente cuánto debe cada uno.',
  },
  {
    icon: 'package',
    title: 'Registra cuotas y financiamientos',
    text: '¿Compraste algo en cuotas? En el plan Pro, registra cuotas simples y sigue su progreso. SAC y Price, con tabla de amortización, forman parte del plan Premium, que todavía está en preparación.',
  },
  {
    icon: 'chart-bar',
    title: 'Sigue todo desde la pantalla de inicio',
    text: 'La pantalla de inicio resume el mes: total gastado, cuánto pagó cada uno, cuánto debería pagar cada uno y el saldo entre ustedes. Es el primer lugar para revisar si las cuentas están al día.',
  },
  {
    icon: 'chart-line',
    title: 'Analiza tendencias en Gráficos',
    text: '¿Quieres entender hacia dónde va el dinero? En Gráficos puedes ver la evolución de los gastos mes a mes, el ranking de categorías y la comparación entre lo que pagó cada uno y lo que debería haber pagado.',
  },
];

export const FAQ_ITEMS = [
  {
    q: '¿Cómo funciona la división proporcional?',
    a: 'La app suma tu ingreso y el de tu pareja y calcula la proporción de cada uno. Si ganas el 60% del ingreso de la pareja, tu parte proporcional en cada gasto compartido es 60%, y la de tu pareja, 40%. Esto se actualiza automáticamente cada vez que se actualiza el ingreso registrado.',
  },
  {
    q: 'Mi pareja no quiere (o no puede) crear una cuenta. ¿Y ahora?',
    a: 'No hay problema. En Ajustes, en la sección Pareja, puedes registrar una "pareja manual": solo su nombre y su ingreso. La app usa esos datos para los cálculos con normalidad, pero tú sigues siendo quien responde por las acciones.',
  },
  {
    q: '¿Puedo eliminar una transacción por error?',
    a: 'Solo quien pagó puede eliminar la transacción. Esto es intencional: evita que una persona borre un gasto que la otra registró. Al hacer clic en eliminar, la app siempre pide confirmación antes.',
  },
  {
    q: '¿Qué cambia entre los planes Gratis y Pro?',
    a: 'El plan Gratis cubre gastos y el panel principal. El Pro agrega cuotas simples, gráficos, exportación puntual y la guía de financiamientos. El Premium, todavía no disponible para compra, agregará SAC, Price y Open Finance. Tus datos son tuyos en cualquier plan: en Gratis, el titular puede descargar el historial antes de cerrar la cuenta; en Pro y Premium, la exportación también está disponible en cualquier momento.',
  },
  {
    q: '¿Para qué sirve el día de cierre del hogar?',
    a: 'Define cuándo "cambia" el mes en los informes. Por defecto es el último día del mes actual, pero puedes configurar un día fijo (por ejemplo, todos los días 5) o una cantidad de días hábiles, lo que ayuda a quien recibe su sueldo en fechas variables.',
  },
  {
    q: '¿Mis datos son visibles para otras personas?',
    a: 'Solo quienes están en el mismo hogar (tú y tu pareja) pueden ver las transacciones, cuotas e ingresos registrados. El acceso está controlado por reglas de seguridad en la base de datos, no solo en la pantalla.',
  },
  {
    q: '¿Cómo cambio entre el tema claro y el oscuro?',
    a: 'En Ajustes > Apariencia, o con el ícono de sol/luna en la barra lateral. También existe la opción "Sistema", que sigue automáticamente la preferencia de tu celular o computadora.',
  },
];

// Guía de financiamientos — exclusiva para suscriptores Pro/Premium (la
// función 'guide' controla el acceso, ver src/services/subscription.js).
export const FINANCING_GUIDE = [
  {
    icon: 'plus-circle',
    title: 'Cómo registrar un financiamiento nuevo',
    text: 'Ve a Cuotas y haz clic en "Nueva cuota". Elige el tipo: En cuotas para compras simples sin intereses, o SAC/Price para financiamientos reales (propiedad, vehículo). Completa el valor total, la entrada, el número de cuotas y, en el caso de SAC/Price, la tasa de interés anual del contrato.',
  },
  {
    icon: 'clock-counter-clockwise',
    title: 'Cómo registrar algo que ya está en curso',
    text: '¿Ya llevas un tiempo pagando el financiamiento? En el formulario de nueva cuota, completa el campo "Cuotas ya pagadas" con el número de cuotas saldadas hasta hoy. La app comienza el progreso justo en el punto correcto, sin que tengas que hacer clic en "Pagar cuota" muchas veces solo para ponerte al día.',
  },
  {
    icon: 'package',
    title: 'Cómo funciona el modelo En cuotas',
    text: 'Es el modelo más simple: sin intereses, la cuota siempre es el valor total dividido entre el número de cuotas. Funciona bien para compras en cuotas con tarjeta o acuerdos sin cobro de intereses.',
  },
  {
    icon: 'house-line',
    title: 'Cómo funciona la tabla SAC',
    text: 'SAC (Sistema de Amortização Constante — "Sistema de Amortización Constante") es un método de amortización brasileño: no tiene un nombre exactamente equivalente fuera de Brasil, pero el mecanismo es sencillo de entender. El monto amortizado es igual todos los meses, mientras que los intereses se calculan sobre el saldo pendiente, que va disminuyendo. Resultado: la cuota empieza más alta y va bajando mes a mes hasta el final del contrato.',
  },
  {
    icon: 'car',
    title: 'Cómo funciona la tabla Price',
    text: 'Price es el nombre que se usa en Brasil para el sistema francés de amortización — la estructura de préstamo con cuota fija estándar a nivel internacional (el "sistema francés" que probablemente ya conoces). La cuota se mantiene igual de principio a fin, pero su composición interna cambia: al principio, la mayor parte son intereses; hacia el final, la mayor parte es amortización del capital. Lo que sale de tu bolsillo cada mes no cambia, solo cambia la "receta" detrás de ese monto.',
  },
  {
    icon: 'lightbulb',
    title: 'Cuándo suele aparecer cada sistema',
    text: 'En Brasil, el SAC es común en financiamientos de vivienda (la cuota decreciente pesa menos hacia el final) y el Price suele aparecer en financiamientos de vehículos. No es una regla fija — cada banco define lo que ofrece — pero ayuda a reconocer qué tabla probablemente usa tu contrato.',
  },
];

export const FINANCE_TIPS = [
  {
    icon: 'chats-circle',
    title: 'Hablen de dinero antes de que se vuelva un problema',
    text: 'Las parejas que hablan de finanzas con regularidad, no solo cuando algo sale mal, tienden a pelear menos por dinero. Programen una conversación breve cada mes para revisar los gastos y alinear prioridades, antes de que los números se conviertan en una sorpresa desagradable.',
  },
  {
    icon: 'scales',
    title: 'Proporcional no siempre es 50/50, y está bien',
    text: 'Dividir todo por la mitad parece justo, pero puede pesar demasiado para quien gana menos. Dividir de forma proporcional al ingreso suele ser más sostenible a largo plazo: cada uno contribuye según lo que gana, y nadie queda en números rojos solo por pagar las cuentas de la pareja.',
  },
  {
    icon: 'piggy-bank',
    title: 'Tengan un fondo de emergencia como pareja',
    text: 'Antes de invertir o hacer planes ambiciosos, guarden de tres a seis meses de gastos básicos en un lugar de fácil acceso. Así, un imprevisto — un despido, una reparación costosa — no se convierte en una crisis financiera desde cero.',
  },
  {
    icon: 'target',
    title: 'Definan metas con plazo, no solo deseos',
    text: '"Ahorrar más" no es una meta, es una intención. "Guardar $500 al mes para la entrada de un departamento en dos años" es una meta. Cuanto más concreta sea la meta, más fácil es seguir el progreso y celebrar cuando se alcanza.',
  },
  {
    icon: 'eye',
    title: 'La transparencia total evita la desconfianza',
    text: 'Los gastos ocultos, incluso los pequeños, erosionan la confianza cuando se descubren. Registrar todo en el mismo lugar, hasta ese antojo que compraron en la calle, mantiene las cuentas claras y evita la sensación de que alguien está ocultando información.',
  },
  {
    icon: 'calendar-check',
    title: 'Revisen juntos cada mes, aunque sea rápido',
    text: 'No hace falta que sea una reunión formal. Diez minutos viendo el resumen del mes — qué se gastó, qué quedó, qué viene — ya ayudan a detectar problemas a tiempo y ajustar el presupuesto antes de que se salga de control.',
  },
  {
    icon: 'handshake',
    title: 'Los financiamientos grandes merecen una decisión conjunta',
    text: 'Antes de asumir un financiamiento a largo plazo, simulen juntos el impacto mensual en el ingreso de la pareja. Una cuota que parece pequeña por sí sola puede pesar bastante al sumarse a todo lo demás que ya tienen comprometido.',
  },
];
