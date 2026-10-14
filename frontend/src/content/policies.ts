// Texto de las políticas que el usuario acepta al ingresar al portal.
//
// IMPORTANTE: si se cambia el contenido de cualquiera de las dos políticas,
// subir también CURRENT_POLICY_VERSION en backend/src/config/policies.ts para
// que todos los usuarios deban aceptarlas de nuevo y quede un registro nuevo.
//
// Marco de referencia: Ley Orgánica de Protección de Datos Personales del
// Ecuador (LOPDP). Este texto es una base de trabajo: debe ser revisado y
// aprobado por el área legal / delegado de protección de datos de ECSA.

import type { Lang } from "../context/LanguageContext";

export interface PolicySection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface PolicyDocument {
  id: "data" | "cookies";
  title: string;
  updated: string;
  sections: PolicySection[];
}

const DATA_ES: PolicyDocument = {
  id: "data",
  title: "Política de Protección de Datos Personales",
  updated: "Vigente desde el 14 de octubre de 2026",
  sections: [
    {
      heading: "1. Responsable del tratamiento",
      paragraphs: [
        "ECUACORRIENTE S.A. (ECSA) es la responsable del tratamiento de los datos personales que se registran en el Portal de Capacitación en Seguridad y Salud en el Trabajo (SST). Esta política explica qué datos se tratan, para qué, quién puede acceder a ellos y cuáles son sus derechos, conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador.",
      ],
    },
    {
      heading: "2. Datos personales que se tratan",
      bullets: [
        "Identificación y ubicación laboral: código de trabajador, nombres y apellidos, correo, número de identificación, empresa, área, cargo y categoría.",
        "Actividad de formación: capacitaciones asignadas, lecciones completadas, intentos y resultados de evaluaciones, certificados emitidos.",
        "Datos técnicos de uso: fecha y hora de ingreso, dirección IP, tipo de navegador y tiempo de conexión al portal.",
        "Registro de aceptación de esta política y de la política de cookies.",
      ],
      paragraphs: [
        "Su contraseña nunca se guarda en texto legible: se almacena únicamente de forma cifrada (hash) y no puede ser consultada por ninguna persona, incluidos los administradores.",
      ],
    },
    {
      heading: "3. Finalidades del tratamiento",
      bullets: [
        "Asignar, impartir y registrar las capacitaciones en seguridad y salud en el trabajo.",
        "Evaluar conocimientos y emitir certificados verificables.",
        "Demostrar el cumplimiento de las obligaciones de SST ante la empresa y las autoridades competentes.",
        "Generar reportes de avance y cumplimiento para la gestión de SST.",
        "Garantizar la seguridad del portal: control de acceso, prevención de uso indebido y trazabilidad de acciones (auditoría).",
      ],
      paragraphs: ["Sus datos no se utilizan para publicidad ni para decisiones automatizadas sobre su relación laboral o contractual."],
    },
    {
      heading: "4. Base de legitimación",
      paragraphs: [
        "El tratamiento se apoya en el cumplimiento de obligaciones legales en materia de seguridad y salud en el trabajo y en la ejecución de la relación laboral o contractual con ECSA. La aceptación de esta política deja constancia de que usted fue informado sobre el tratamiento de sus datos.",
      ],
    },
    {
      heading: "5. Quién accede a sus datos y con quién se comparten",
      bullets: [
        "Personal autorizado de ECSA con funciones de SST y administración del portal, según su rol y solo para las finalidades indicadas.",
        "Autoridades competentes, cuando una norma lo exija.",
        "Proveedores de infraestructura tecnológica (alojamiento en la nube y base de datos) que actúan por cuenta de ECSA y bajo medidas de seguridad; sus servidores pueden estar ubicados fuera del Ecuador.",
      ],
      paragraphs: ["ECSA no vende ni cede sus datos personales a terceros con fines comerciales."],
    },
    {
      heading: "6. Conservación",
      paragraphs: [
        "Los datos se conservan mientras dure la relación laboral o contractual y durante el tiempo que exijan las normas de seguridad y salud en el trabajo y de conservación de documentos. Transcurrido ese plazo se eliminan o se anonimizan.",
      ],
    },
    {
      heading: "7. Medidas de seguridad",
      bullets: [
        "Comunicación cifrada (HTTPS) entre su navegador y el portal.",
        "Contraseñas protegidas con algoritmos de cifrado robustos y bloqueo temporal tras intentos fallidos.",
        "Control de acceso por roles: cada persona solo ve lo que su función requiere.",
        "Cierre automático de sesión por inactividad y posibilidad de revocar sesiones.",
        "Registro de auditoría de los eventos sensibles del sistema.",
      ],
    },
    {
      heading: "8. Sus derechos",
      paragraphs: [
        "Usted puede ejercer en cualquier momento sus derechos de acceso, rectificación y actualización, eliminación, oposición, portabilidad y suspensión del tratamiento de sus datos, así como a no ser objeto de decisiones basadas únicamente en valoraciones automatizadas, en los términos de la ley.",
        "Para ejercerlos, presente su solicitud a ECSA a través del área de Gestión de Seguridad Industrial y Salud Ocupacional o del administrador del portal. Si considera que sus derechos no fueron atendidos, puede acudir ante la Autoridad de Protección de Datos Personales del Ecuador.",
      ],
    },
    {
      heading: "9. Sus responsabilidades",
      bullets: [
        "Mantener su contraseña en reserva y no compartirla con otras personas.",
        "Cerrar sesión al terminar, sobre todo en equipos compartidos.",
        "Informar a su administrador si detecta un uso indebido de su cuenta o un error en sus datos.",
      ],
    },
    {
      heading: "10. Cambios a esta política",
      paragraphs: [
        "Si esta política cambia, el portal le pedirá aceptarla nuevamente la próxima vez que ingrese. Cada aceptación queda registrada con su fecha, hora y versión.",
      ],
    },
  ],
};

const COOKIES_ES: PolicyDocument = {
  id: "cookies",
  title: "Política de Uso de Cookies",
  updated: "Vigente desde el 14 de octubre de 2026",
  sections: [
    {
      heading: "1. Qué son las cookies",
      paragraphs: [
        "Las cookies son pequeños archivos que el portal guarda en su navegador para funcionar correctamente. El portal también usa el almacenamiento local del navegador (localStorage) para recordar preferencias sencillas.",
      ],
    },
    {
      heading: "2. Qué utiliza este portal",
      bullets: [
        "sid — cookie de sesión (estrictamente necesaria): mantiene su sesión iniciada. Es HttpOnly y de duración limitada (8 horas).",
        "csrf_token — cookie de seguridad (estrictamente necesaria): protege el portal frente a solicitudes falsificadas.",
        "ecsa-lang — almacenamiento local (preferencia): recuerda el idioma elegido (español o 中文).",
        "ecsa-sidebar-collapsed — almacenamiento local (preferencia): recuerda si dejó el menú lateral contraído.",
      ],
    },
    {
      heading: "3. Lo que no utilizamos",
      paragraphs: [
        "El portal no usa cookies de publicidad, de analítica ni de seguimiento de su navegación, y no crea perfiles de comportamiento con fines comerciales.",
      ],
    },
    {
      heading: "4. Contenido de terceros",
      paragraphs: [
        "Algunas lecciones incluyen videos alojados en YouTube. Al reproducirlos, YouTube (Google) puede guardar sus propias cookies según su política. Si prefiere evitarlo, puede no reproducir esos videos.",
      ],
    },
    {
      heading: "5. Cómo controlarlas",
      paragraphs: [
        "Puede borrar o bloquear las cookies desde la configuración de su navegador. Tenga en cuenta que, si bloquea las cookies necesarias, no podrá iniciar sesión ni usar el portal.",
      ],
    },
    {
      heading: "6. Aceptación y registro",
      paragraphs: [
        "Usted acepta esta política una sola vez al ingresar al portal. La aceptación queda registrada (usuario, fecha, hora y versión) y solo se vuelve a solicitar si la política cambia.",
      ],
    },
  ],
};

const DATA_ZH: PolicyDocument = {
  id: "data",
  title: "个人数据保护政策",
  updated: "自2026年10月14日起生效",
  sections: [
    {
      heading: "1. 数据处理责任人",
      paragraphs: [
        "ECUACORRIENTE S.A.（ECSA）是职业安全与健康（SST）培训门户中所登记个人数据的处理责任人。本政策依据厄瓜多尔《个人数据保护组织法》，说明处理哪些数据、处理目的、哪些人员可以访问以及您享有的权利。",
      ],
    },
    {
      heading: "2. 处理的个人数据",
      bullets: [
        "身份与工作信息：员工编号、姓名、电子邮箱、证件号码、公司、部门、职位和类别。",
        "培训活动：分配的培训、已完成的课时、测评次数与成绩、已颁发的证书。",
        "技术使用数据：登录日期和时间、IP地址、浏览器类型以及在门户的在线时长。",
        "本政策及Cookie政策的接受记录。",
      ],
      paragraphs: ["您的密码不会以明文保存：仅以加密形式（哈希）存储，任何人（包括管理员）均无法查看。"],
    },
    {
      heading: "3. 处理目的",
      bullets: [
        "分配、开展并记录职业安全与健康培训。",
        "评估知识掌握情况并颁发可验证的证书。",
        "向公司及主管部门证明已履行职业安全与健康义务。",
        "生成用于职业安全与健康管理的进度与合规报告。",
        "保障门户安全：访问控制、防止滥用以及操作可追溯（审计）。",
      ],
      paragraphs: ["您的数据不会用于广告，也不会用于对您的劳动或合同关系作出自动化决策。"],
    },
    {
      heading: "4. 合法性依据",
      paragraphs: [
        "数据处理基于履行职业安全与健康方面的法定义务以及与ECSA的劳动或合同关系。接受本政策即表示您已被告知您的数据将如何被处理。",
      ],
    },
    {
      heading: "5. 谁可以访问以及与谁共享",
      bullets: [
        "ECSA中负责职业安全与健康及门户管理的授权人员，按其角色并仅限于上述目的。",
        "法律要求时，向有权限的主管部门提供。",
        "代表ECSA并在安全措施下提供技术基础设施（云托管和数据库）的服务商；其服务器可能位于厄瓜多尔境外。",
      ],
      paragraphs: ["ECSA不会出于商业目的出售或转让您的个人数据。"],
    },
    {
      heading: "6. 保存期限",
      paragraphs: ["数据在劳动或合同关系存续期间，以及职业安全与健康和文件保存法规要求的期限内保存。期限届满后将予以删除或匿名化。"],
    },
    {
      heading: "7. 安全措施",
      bullets: [
        "浏览器与门户之间采用加密通信（HTTPS）。",
        "密码采用强加密算法保护，多次登录失败后临时锁定。",
        "基于角色的访问控制：每个人只能查看其职责所需内容。",
        "无操作自动退出登录，并可撤销会话。",
        "对系统敏感事件进行审计记录。",
      ],
    },
    {
      heading: "8. 您的权利",
      paragraphs: [
        "您可随时依法行使访问、更正和更新、删除、反对、可携带以及暂停处理您数据的权利，并有权不受仅基于自动化评估的决定约束。",
        "如需行使上述权利，请通过ECSA工业安全与职业健康管理部门或门户管理员向ECSA提出申请。如认为您的权利未得到处理，可向厄瓜多尔个人数据保护主管机构申诉。",
      ],
    },
    {
      heading: "9. 您的责任",
      bullets: ["妥善保管密码，不与他人共享。", "使用完毕后退出登录，尤其是在共用设备上。", "发现账号被滥用或数据有误时，请告知管理员。"],
    },
    {
      heading: "10. 政策变更",
      paragraphs: ["如本政策发生变更，门户将在您下次登录时要求您重新接受。每次接受均会记录日期、时间和版本。"],
    },
  ],
};

const COOKIES_ZH: PolicyDocument = {
  id: "cookies",
  title: "Cookie使用政策",
  updated: "自2026年10月14日起生效",
  sections: [
    {
      heading: "1. 什么是Cookie",
      paragraphs: ["Cookie是门户为正常运行而保存在您浏览器中的小文件。门户还使用浏览器本地存储（localStorage）来记住简单的偏好设置。"],
    },
    {
      heading: "2. 本门户使用的内容",
      bullets: [
        "sid —— 会话Cookie（严格必要）：保持您的登录状态。采用HttpOnly，有效期有限（8小时）。",
        "csrf_token —— 安全Cookie（严格必要）：防止门户遭受伪造请求。",
        "ecsa-lang —— 本地存储（偏好）：记住您选择的语言（西班牙语或中文）。",
        "ecsa-sidebar-collapsed —— 本地存储（偏好）：记住您是否收起了侧边菜单。",
      ],
    },
    {
      heading: "3. 我们不使用的内容",
      paragraphs: ["本门户不使用广告、统计分析或浏览跟踪类Cookie，也不会出于商业目的建立行为画像。"],
    },
    {
      heading: "4. 第三方内容",
      paragraphs: ["部分课时包含托管于YouTube的视频。播放时，YouTube（Google）可能依据其政策保存自己的Cookie。如不希望如此，可选择不播放这些视频。"],
    },
    {
      heading: "5. 如何管理",
      paragraphs: ["您可以在浏览器设置中删除或阻止Cookie。请注意，如阻止必要的Cookie，您将无法登录或使用门户。"],
    },
    {
      heading: "6. 接受与记录",
      paragraphs: ["您在进入门户时仅需接受一次本政策。接受情况将被记录（用户、日期、时间和版本），仅在政策变更时才会再次询问。"],
    },
  ],
};

export const POLICIES: Record<Lang, PolicyDocument[]> = {
  es: [DATA_ES, COOKIES_ES],
  zh: [DATA_ZH, COOKIES_ZH],
};
