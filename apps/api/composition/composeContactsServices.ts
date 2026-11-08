import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlContactRepository, SqlLabelRepository } from "../../../infrastructure/persistence/sql/SqlContactRepositories";
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
}

export function composeContactsServices(sqlClient: SqlClient): ContactsServices {
  const contacts = new SqlContactRepository(sqlClient);
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
    directory: new ContactDirectoryService(contacts, labels)
  };
}
