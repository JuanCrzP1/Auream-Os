import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlContactRepository, SqlLabelRepository } from "../../../infrastructure/persistence/sql/SqlContactRepositories";
import type { ContactRepository, LabelRepository } from "../../../domains/contacts/application/ContactRepository";
import { LabelRulesContactRepository } from "../../../domains/contacts/application/LabelRulesContactRepository";
import { NO_CONTACT_EVENTS, NO_EXCLUSIVE_GROUPS, type ContactEvents, type ExclusiveLabelGroups } from "../../../domains/contacts/application/LabelHooks";
import { ContactDirectoryService } from "../../../domains/contacts/application/ContactDirectoryService";
import {
  CreateContactService,
  GetContactService,
  ListContactsService,
  SetContactLabelsService,
  UpdateContactService
} from "../../../domains/contacts/application/ContactServices";
import {
  CreateLabelService,
  DeleteLabelService,
  ListLabelsService,
  UpdateLabelService
} from "../../../domains/contacts/application/LabelCatalogServices";

// ---------------------------------------------------------------------------
// composeContactsServices — el módulo de Contactos sobre PostgreSQL. Único
// punto que elige la implementación; los casos de uso solo conocen puertos.
//
// Todo cambio de etiquetas pasa por `LabelRulesContactRepository`: aplica los
// grupos excluyentes (las etapas de un embudo del CRM) y avisa lo que cambió.
// ---------------------------------------------------------------------------

export interface ContactsServices {
  readonly listContacts: ListContactsService;
  readonly getContact: GetContactService;
  readonly createContact: CreateContactService;
  readonly updateContact: UpdateContactService;
  readonly setContactLabels: SetContactLabelsService;
  readonly listLabels: ListLabelsService;
  readonly createLabel: CreateLabelService;
  readonly updateLabel: UpdateLabelService;
  readonly deleteLabel: DeleteLabelService;
  /** Lo que usa el motor en producción (puerto `ContactDirectory`). */
  readonly directory: ContactDirectoryService;
  /** El repositorio con sus reglas (lo usa el CRM para mover etiquetas). */
  readonly repository: ContactRepository;
  readonly labelRepository: LabelRepository;
}

export interface ContactHooks {
  readonly groups: ExclusiveLabelGroups;
  readonly events: ContactEvents;
  readonly onError: (error: unknown) => void;
}

export function composeContactsServices(sqlClient: SqlClient, hooks?: ContactHooks): ContactsServices {
  const contacts = new LabelRulesContactRepository(
    new SqlContactRepository(sqlClient),
    hooks?.groups ?? NO_EXCLUSIVE_GROUPS,
    hooks?.events ?? NO_CONTACT_EVENTS,
    hooks?.onError
  );
  const labels = new SqlLabelRepository(sqlClient);

  return {
    listContacts: new ListContactsService(contacts),
    getContact: new GetContactService(contacts),
    createContact: new CreateContactService(contacts),
    updateContact: new UpdateContactService(contacts),
    setContactLabels: new SetContactLabelsService(contacts, labels),
    listLabels: new ListLabelsService(labels),
    createLabel: new CreateLabelService(labels),
    updateLabel: new UpdateLabelService(labels),
    deleteLabel: new DeleteLabelService(labels),
    directory: new ContactDirectoryService(contacts, labels),
    repository: contacts,
    labelRepository: labels
  };
}
