import { validate } from 'class-validator';
import { CreateCriterionDto } from '../dto/create-criterion.dto';
import { plainToInstance } from 'class-transformer';

describe('CreateCriterionDto', () => {
  it('should accept an optional description and remain compatible when omitted', async () => {
    const withDescription = plainToInstance(CreateCriterionDto, {
      category_id: '60c72b2f9b1d8e251c888888',
      criterion_code: 'CRI-DESC',
      criterion_name: 'Short name',
      description: '  Supporting detail  ',
      criterion_type: 'cong_diem',
      scoring_mode: 'count',
    });
    const withoutDescription = plainToInstance(CreateCriterionDto, {
      category_id: '60c72b2f9b1d8e251c888888',
      criterion_code: 'CRI-NO-DESC',
      criterion_name: 'Legacy criterion',
      criterion_type: 'cong_diem',
      scoring_mode: 'count',
    });

    expect((await validate(withDescription)).length).toBe(0);
    expect((await validate(withoutDescription)).length).toBe(0);
  });

  it('should reject a non-string description', async () => {
    const dto = plainToInstance(CreateCriterionDto, {
      category_id: '60c72b2f9b1d8e251c888888',
      criterion_code: 'CRI-BAD-DESC',
      criterion_name: 'Invalid description',
      description: 123,
      criterion_type: 'cong_diem',
      scoring_mode: 'count',
    });

    expect(
      (await validate(dto)).find((error) => error.property === 'description'),
    ).toBeDefined();
  });
  it('should validate successfully when scoring_mode is count and options are not provided', async () => {
    const dto = plainToInstance(CreateCriterionDto, {
      category_id: '60c72b2f9b1d8e251c888888',
      criterion_code: 'CRI-1',
      criterion_name: 'Test count mode',
      criterion_type: 'cong_diem',
      scoring_mode: 'count',
    });
    const errors = await validate(dto);
    console.log(errors);
    expect(errors.length).toBe(0);
  });

  it('should validate successfully when scoring_mode is single_option and valid options are provided', async () => {
    const dto = plainToInstance(CreateCriterionDto, {
      category_id: '60c72b2f9b1d8e251c888888',
      criterion_code: 'CRI-2',
      criterion_name: 'Test single_option mode',
      criterion_type: 'cong_diem',
      scoring_mode: 'single_option',
      options: [{ id: 'opt1', label: 'Option 1', score: 10 }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation when scoring_mode is single_option but options are missing or invalid', async () => {
    const dtoMissing = plainToInstance(CreateCriterionDto, {
      category_id: '60c72b2f9b1d8e251c888888',
      criterion_name: 'Test single_option mode missing options',
      criterion_type: 'cong_diem',
      scoring_mode: 'single_option',
    });
    const errorsMissing = await validate(dtoMissing);
    expect(errorsMissing.length).toBeGreaterThan(0);
    expect(errorsMissing.find((e) => e.property === 'options')).toBeDefined();

    const dtoInvalid = plainToInstance(CreateCriterionDto, {
      category_id: '60c72b2f9b1d8e251c888888',
      criterion_name: 'Test single_option mode invalid options',
      criterion_type: 'cong_diem',
      scoring_mode: 'single_option',
      options: [
        { id: 'opt1' }, // Missing label and score
      ],
    });
    const errorsInvalid = await validate(dtoInvalid);
    expect(errorsInvalid.length).toBeGreaterThan(0);
    expect(errorsInvalid.find((e) => e.property === 'options')).toBeDefined();
  });
  it('should fail validation when scoring_mode is single_option and options is an empty array', async () => {
    const dto = plainToInstance(CreateCriterionDto, {
      category_id: '60c72b2f9b1d8e251c888888',
      criterion_name: 'Test empty options',
      criterion_type: 'cong_diem',
      scoring_mode: 'single_option',
      options: [],
    });
    const errors = await validate(dto);
    const optionsError = errors.find((e) => e.property === 'options');
    expect(optionsError).toBeDefined();
    expect(optionsError?.constraints?.arrayNotEmpty).toBeDefined();
  });

  it('should fail validation when scoring_mode is single_option and options contain duplicate IDs', async () => {
    const dto = plainToInstance(CreateCriterionDto, {
      category_id: '60c72b2f9b1d8e251c888888',
      criterion_name: 'Test duplicate options',
      criterion_type: 'cong_diem',
      scoring_mode: 'single_option',
      options: [
        { id: 'opt1', label: 'Option 1', score: 10 },
        { id: 'opt1', label: 'Option 2', score: 20 },
      ],
    });
    const errors = await validate(dto);
    const optionsError = errors.find((e) => e.property === 'options');
    expect(optionsError).toBeDefined();
    expect(optionsError?.constraints?.arrayUnique).toBeDefined();
  });
  it('should validate successfully when options contain _id field', async () => {
    const dto = plainToInstance(CreateCriterionDto, {
      category_id: '60c72b2f9b1d8e251c888888',
      criterion_code: 'CRI-5',
      criterion_name: 'Test options with _id',
      criterion_type: 'cong_diem',
      scoring_mode: 'single_option',
      options: [
        {
          _id: '60c72b2f9b1d8e251c888889',
          id: 'opt1',
          label: 'Option 1',
          score: 10,
        },
      ],
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.length).toBe(0);
  });
});
