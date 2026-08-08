/* ══════════════════════════════════════════════
   juntos.cash — Changelog: Español
   Traducido de changelog.pt-BR.js (fuente de la verdad).
   ══════════════════════════════════════════════ */

export const APP_VERSION = '1.0.0';

export const CHANGELOG = [
  {
    version: '1.0.0',
    date: '2026-07-20',
    label: 'Preparación para el lanzamiento',
    fixes: [
      'Corregida una falla de compilación causada por dependencias desactualizadas',
      'Cerrado un acceso público innecesario a una rutina interna de mantenimiento',
    ],
    features: [],
  },
  {
    version: '0.2.0',
    date: '2026-07-04',
    label: 'Tema claro, ajustes reorganizados y ayuda en la app',
    fixes: [
      'Las tarjetas de la pantalla de inicio ahora usan la misma cuadrícula arriba y abajo, sin desalineación entre filas',
      'Corregido el contraste de textos en el tema claro (nombres y valores que quedaban casi invisibles sobre el fondo)',
      'Las etiquetas de mes en los gráficos ahora muestran mes y año en la misma línea, sin salto de línea extraño',
      'La página de Ajustes ahora ocupa el ancho correcto de la pantalla, igual que las demás páginas',
    ],
    features: [
      'Tema claro y oscuro, con opción de seguir automáticamente el sistema (en Ajustes > Apariencia)',
      'Ajustes reorganizados en Perfil, Pareja, Hogar y Apariencia, cada información en su lugar correcto',
      'Plan Pro liberado para todos durante las pruebas, directamente desde Ajustes > Perfil',
      'Nuevo gráfico que consolida las cuotas contratadas con el promedio de gastos de los últimos meses',
      'Tutorial, Preguntas frecuentes y Consejos financieros para parejas, ahora dentro de la propia app',
      'Insignia de versión y novedades movida al final de Ajustes',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-07-03',
    label: 'Primer lanzamiento',
    fixes: [
      'Corregido el cálculo de saldo en el Panel al usar división proporcional',
      'Corregido el listado de transacciones mostrando el pagador correcto (paid_by_manual)',
      'Corregida la actualización de transacciones manteniendo el pagador seleccionado en el formulario',
      'Corregido el respaldo del RPC de eliminación de transacciones usando el parámetro correcto',
      'Agregada protección contra división por cero al mostrar el valor de una cuota',
      'Corregidos errores que usaban innerHTML sin escapar los mensajes',
    ],
    features: [
      'Pantalla de inicio con resumen del mes, saldo por persona y categorías',
      'Gestión de gastos compartidos con división proporcional, 50/50 o individual',
      'Financiamientos y cuotas con seguimiento de progreso',
      'Gráficos mensuales, por categoría y proyección de cuotas',
      'Tablas de amortización SAC y Price',
      'Sistema de planes (Gratis / Pro / Premium)',
      'Ajustes de perfil, hogar y métodos de pago',
    ],
  },
];
