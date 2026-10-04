import { TestBed } from '@angular/core/testing';
import { DocumentUploadForm } from './document-upload-form';
import { DocumentService } from '../../core/services/document.service';

describe('DocumentUploadForm', () => {
  let upload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    upload = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: DocumentService, useValue: { upload } }],
    });
  });

  function setValue(el: HTMLElement, selector: string, value: string) {
    const field = el.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  it('disables submit until both title and content are non-empty', () => {
    const fixture = TestBed.createComponent(DocumentUploadForm);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(button.disabled).toBe(true);

    setValue(el, 'input', 'Title');
    fixture.detectChanges();
    expect(button.disabled).toBe(true);

    setValue(el, 'textarea', 'Content');
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
  });

  it('uploads and clears the form on submit', () => {
    const fixture = TestBed.createComponent(DocumentUploadForm);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    setValue(el, 'input', 'My Title');
    setValue(el, 'textarea', 'My Content');
    fixture.detectChanges();

    fixture.componentInstance.submit();

    expect(upload).toHaveBeenCalledWith('My Title', 'My Content');
    expect(fixture.componentInstance.title()).toBe('');
    expect(fixture.componentInstance.content()).toBe('');
  });

  it('does nothing when submitted while invalid', () => {
    const fixture = TestBed.createComponent(DocumentUploadForm);
    fixture.detectChanges();

    fixture.componentInstance.submit();

    expect(upload).not.toHaveBeenCalled();
  });
});
